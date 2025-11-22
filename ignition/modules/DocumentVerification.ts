import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DocumentVerificationModule = buildModule("DocumentVerificationModule", (m) => {
  const documentVerification = m.contract("DocumentVerification");
  
  return { documentVerification };
});

export default DocumentVerificationModule;