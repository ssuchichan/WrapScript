export const factoryABI = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_deployer",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "agency",
        "inputs": [
            {
                "name": "instance",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "agencyInst",
        "inputs": [
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "instance",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "app",
        "inputs": [
            {
                "name": "instance",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "appInst",
        "inputs": [
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "instance",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "deployERC7527",
        "inputs": [
            {
                "name": "agencySettings",
                "type": "tuple",
                "internalType": "struct AgencySettings",
                "components": [
                    {
                        "name": "implementation",
                        "type": "address",
                        "internalType": "address payable"
                    },
                    {
                        "name": "asset",
                        "type": "tuple",
                        "internalType": "struct Asset",
                        "components": [
                            {
                                "name": "currency",
                                "type": "address",
                                "internalType": "address"
                            },
                            {
                                "name": "basePremium",
                                "type": "uint256",
                                "internalType": "uint256"
                            },
                            {
                                "name": "feeRecipient",
                                "type": "address",
                                "internalType": "address"
                            },
                            {
                                "name": "mintFeePercent",
                                "type": "uint16",
                                "internalType": "uint16"
                            },
                            {
                                "name": "burnFeePercent",
                                "type": "uint16",
                                "internalType": "uint16"
                            }
                        ]
                    },
                    {
                        "name": "immutableData",
                        "type": "bytes",
                        "internalType": "bytes"
                    },
                    {
                        "name": "initData",
                        "type": "bytes",
                        "internalType": "bytes"
                    }
                ]
            },
            {
                "name": "appSettings",
                "type": "tuple",
                "internalType": "struct AppSettings",
                "components": [
                    {
                        "name": "implementation",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "immutableData",
                        "type": "bytes",
                        "internalType": "bytes"
                    },
                    {
                        "name": "initData",
                        "type": "bytes",
                        "internalType": "bytes"
                    }
                ]
            },
            {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [
            {
                "name": "agencyInstance",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deployer",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nonce",
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "Deploy",
        "inputs": [
            {
                "name": "agencyImplementation",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "agencyInstance",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "appImplementation",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "appInstance",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "CreateFail",
        "inputs": []
    },
    {
        "type": "error",
        "name": "FactoryNoapproved",
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    }
] as const;

export const wrapFactory = {
    address: "0x94691424e34aEBB03499072D93a3f024F519E87A",
    abi: factoryABI
} as const;