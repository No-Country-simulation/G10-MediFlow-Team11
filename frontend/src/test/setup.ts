import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-document";
}

if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => undefined;
}
