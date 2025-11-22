import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DocumentVerificationModule = buildModule("DocumentVerificationModule", (m) => {
  // XÓA tham số constructor - vì contract không cần
  const documentVerification = m.contract("DocumentVerification");
  
  return { documentVerification };
});

export default DocumentVerificationModule;