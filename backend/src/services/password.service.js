/** Argon2id cho mật khẩu; hash giả giúp đường đăng nhập email lạ vẫn thực hiện phép băm. */
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummyHash;
export const passwords = {
  hash: value => argon2.hash(value, options),
  async verify(hash, value) {
    if (!hash) {
      dummyHash ||= passwords.hash(randomBytes(32).toString('hex'));
      await argon2.verify(await dummyHash, value);
      return false;
    }
    return argon2.verify(hash, value);
  },
};
