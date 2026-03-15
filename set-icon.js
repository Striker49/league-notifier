// set-icon.js
// Usage: node set-icon.js
// Run this AFTER building with pkg, in the same folder as your exe and .ico

const ResEdit = require("resedit");
const fs = require("fs");
const path = require("path");

const exePath = path.join(__dirname, "league-notifier.exe");
const iconPath = path.join(__dirname, "favicon.ico");

console.log("Reading exe...");
const exeData = fs.readFileSync(exePath);
const exe = ResEdit.NtExecutable.from(exeData, { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);

console.log("Reading icon...");
const icoData = fs.readFileSync(iconPath);
const ico = ResEdit.Data.IconFile.from(icoData);

console.log("Injecting icon...");
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  1,       // icon group ID
  1033,    // language: en-US
  ico.icons.map((i) => i.data)
);

res.outputResource(exe);

console.log("Saving exe...");
const newBinary = exe.generate();
fs.writeFileSync(exePath, Buffer.from(newBinary));

console.log("Done! Icon set successfully.");
