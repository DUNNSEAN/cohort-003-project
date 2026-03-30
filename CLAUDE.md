// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};

---

Anything marked as a 'service' (by the name of the file, for instance 'authTokenService.ts') should have tests written for them in an accompanying '.test.ts' file. 