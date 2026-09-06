ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[];
UPDATE "User" SET "roles" = ARRAY["role"];
DROP INDEX IF EXISTS "User_role_idx";
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" ALTER COLUMN "roles" DROP DEFAULT;
