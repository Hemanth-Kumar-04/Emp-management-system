import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();
const saltRounds = +process.env.SALT_OR_ROUNDS;

const generateSalt = () => {
  try {
    const salt = bcrypt.genSaltSync(saltRounds);
    return salt;
  } catch (error) {
    console.error(error);
  }
};

// function to hash the user password
export const encryptPassword = (password) => {
  try {
    const salt = generateSalt();
    const encryptedPassword = bcrypt.hashSync(password, salt);
    return encryptedPassword;
  } catch (error) {
    console.error(error);
    return null;
  }
};
