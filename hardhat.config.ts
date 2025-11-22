import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    rootstockTestnet: {
      type: "http",
      url: "https://public-node.testnet.rsk.co",
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
    },
    xrSepolia: {
      type: "http",
      url: "https://xr-sepolia-testnet.rpc.caldera.xyz/http",
      chainId: 2730,
      accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
    },
    // THÊM COINEX TESTNET
    coinexTestnet: {
  type: "http",
  url: "https://testnet-rpc1.coinex.net",
  chainId: 53,
  accounts: ["2598e686abf8883bc75d45d5ee85f65d5f17477f6358aaa942533d17ea7537fa"],
  gasPrice: 2000000000000, // Tăng lên 2000 gwei
  gas: 5000000, // Thêm gas limit
},
  },
});