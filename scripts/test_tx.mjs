import corePkg from "@multiversx/sdk-core";
const allExports = Object.keys(corePkg);
const rest = allExports.slice(80);
console.log("Remaining exports:", rest);
