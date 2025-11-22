import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MyTokenModule = buildModule("MyTokenModule", (m) => {
  const myToken = m.contract("MyToken"); // Không cần parameters
  return { myToken };
});

export default MyTokenModule;