#!/usr/bin/env bash
input=$(cat)

# Parse all fields in a single python3 call for efficiency
# Use pipe as delimiter so model names with spaces don't shift fields
IFS='|' read -r model used_pct context_size <<< "$(echo "$input" | python3 -c "
import json, sys
d = json.load(sys.stdin)
cw = d.get('context_window', {})
model = d.get('model', {}).get('display_name', 'Unknown')
used_pct = cw.get('used_percentage', '')
context_size = cw.get('context_window_size', 200000)
print('|'.join([model, str(used_pct) if used_pct != '' else 'none', str(context_size)]))
")"

reset="\033[0m"
green="\033[32m"
yellow="\033[33m"
red="\033[31m"

# Back-calculate tokens from used_percentage and context_window_size.
# current_usage reflects only the last API call, not the full context window, so
# we derive the actual tokens-in-context as: (used_pct / 100) * context_size.
if [ "$used_pct" != "none" ] && [ -n "$used_pct" ]; then
  total_tokens=$(awk "BEGIN {printf \"%d\", ($used_pct / 100) * $context_size}")
else
  total_tokens=0
fi

if [ "$total_tokens" -ge 1000 ]; then
  tokens_display="$(awk "BEGIN {printf \"%.1fk\", $total_tokens/1000}") tokens"
else
  tokens_display="${total_tokens} tokens"
fi

# Token color: green below 80k, yellow below 100k, red at 100k+
if [ "$total_tokens" -ge 100000 ]; then
  token_color="$red"
elif [ "$total_tokens" -ge 80000 ]; then
  token_color="$yellow"
else
  token_color="$green"
fi

# Build progress bar (20 chars wide) with color mirroring token thresholds
# Derive percentage thresholds from the 80k/100k token boundaries relative to context window size
bar_str=""
if [ "$used_pct" != "none" ] && [ -n "$used_pct" ]; then
  filled=$(awk "BEGIN {printf \"%d\", ($used_pct / 100) * 20}")
  empty=$((20 - filled))
  bar=""
  for i in $(seq 1 "$filled"); do bar="${bar}█"; done
  for i in $(seq 1 "$empty"); do bar="${bar}░"; done

  pct_int=$(printf "%.0f" "$used_pct")

  # Compute percentage thresholds matching 80k and 100k token boundaries
  yellow_pct=$(awk "BEGIN {printf \"%.0f\", (80000 / $context_size) * 100}")
  red_pct=$(awk "BEGIN {printf \"%.0f\", (100000 / $context_size) * 100}")

  if [ "$pct_int" -ge "$red_pct" ]; then
    bar_color="$red"
  elif [ "$pct_int" -ge "$yellow_pct" ]; then
    bar_color="$yellow"
  else
    bar_color="$green"
  fi

  bar_str="${bar_color}[${bar}]${reset} ${pct_int}%"
fi

# Assemble and print
if [ -n "$bar_str" ]; then
  printf "%s  %b%s%b  %b\n" "$model" "$token_color" "$tokens_display" "$reset" "$bar_str"
else
  printf "%s  %b%s%b\n" "$model" "$token_color" "$tokens_display" "$reset"
fi
