export type SolPredMarket = {
  version: "0.1.0";
  name: "sol_pred_market";
  instructions: [
    {
      name: "createMarket";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "escrowAuthority"; isMut: true; isSigner: false },
        { name: "mint"; isMut: false; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "rent"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "marketId"; type: "string" },
        { name: "feeBps"; type: "u16" },
        { name: "question"; type: "string" }
      ];
    },
    {
      name: "placeBet";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "bet"; isMut: true; isSigner: false },
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "escrowAuthority"; isMut: false; isSigner: false },
        { name: "mint"; isMut: false; isSigner: false },
        { name: "userAta"; isMut: true; isSigner: false },
        { name: "bettor"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "marketId"; type: "string" },
        { name: "amount"; type: "u64" },
        { name: "wageredOutcome"; type: { defined: "MarketResolution" } }
      ];
    },
    {
      name: "resolveMarket";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true }
      ];
      args: [
        { name: "marketId"; type: "string" },
        { name: "resolution"; type: { defined: "MarketResolution" } }
      ];
    },
    {
      name: "claimReward";
      accounts: [
        { name: "market"; isMut: false; isSigner: false },
        { name: "bet"; isMut: true; isSigner: false },
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "escrowAuthority"; isMut: false; isSigner: false },
        { name: "mint"; isMut: false; isSigner: false },
        { name: "userAta"; isMut: true; isSigner: false },
        { name: "bettor"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "marketId"; type: "string" }];
    },
    {
      name: "abortMarket";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true }
      ];
      args: [{ name: "marketId"; type: "string" }];
    },
    {
      name: "withdrawAfterAbort";
      accounts: [
        { name: "market"; isMut: false; isSigner: false },
        { name: "bet"; isMut: true; isSigner: false },
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "escrowAuthority"; isMut: false; isSigner: false },
        { name: "mint"; isMut: false; isSigner: false },
        { name: "userAta"; isMut: true; isSigner: false },
        { name: "bettor"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "marketId"; type: "string" }];
    }
  ];
  accounts: [
    {
      name: "Market";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "publicKey" },
          { name: "bump"; type: "u8" },
          { name: "feeBps"; type: "u16" },
          { name: "marketId"; type: "string" },
          { name: "question"; type: "string" },
          { name: "isClosed"; type: "bool" },
          { name: "outcome"; type: { option: { defined: "Outcome" } } },
          { name: "yesWagered"; type: "u64" },
          { name: "noWagered"; type: "u64" },
          { name: "marketDump"; type: "u8" },
          { name: "escrowBump"; type: "u8" },
          { name: "escrowAuthorityBump"; type: "u8" }
        ];
      };
    },
    {
      name: "Bet";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "publicKey" },
          { name: "bump"; type: "u8" },
          { name: "amount"; type: "u64" },
          { name: "wageredOutcome"; type: { defined: "MarketResolution" } },
          { name: "escrowFundsStatus"; type: { defined: "BetEscrowFundsStatus" } }
        ];
      };
    }
  ];
  types: [
    {
      name: "MarketResolution";
      type: {
        kind: "enum";
        variants: [{ name: "Yes" }, { name: "No" }];
      };
    },
    {
      name: "Outcome";
      type: {
        kind: "enum";
        variants: [{ name: "Yes" }, { name: "No" }];
      };
    },
    {
      name: "BetEscrowFundsStatus";
      type: {
        kind: "enum";
        variants: [{ name: "Funded" }, { name: "Withdrawn" }];
      };
    }
  ];
};

export const IDL: SolPredMarket = {
  version: "0.1.0",
  name: "sol_pred_market",
  instructions: [
    {
      name: "createMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "escrowAuthority", isMut: true, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "string" },
        { name: "feeBps", type: "u16" },
        { name: "question", type: "string" },
      ],
    },
    {
      name: "placeBet",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "bet", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "escrowAuthority", isMut: false, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "userAta", isMut: true, isSigner: false },
        { name: "bettor", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "string" },
        { name: "amount", type: "u64" },
        { name: "wageredOutcome", type: { defined: "MarketResolution" } },
      ],
    },
    {
      name: "resolveMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
      ],
      args: [
        { name: "marketId", type: "string" },
        { name: "resolution", type: { defined: "MarketResolution" } },
      ],
    },
    {
      name: "claimReward",
      accounts: [
        { name: "market", isMut: false, isSigner: false },
        { name: "bet", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "escrowAuthority", isMut: false, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "userAta", isMut: true, isSigner: false },
        { name: "bettor", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "marketId", type: "string" }],
    },
    {
      name: "abortMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
      ],
      args: [{ name: "marketId", type: "string" }],
    },
    {
      name: "withdrawAfterAbort",
      accounts: [
        { name: "market", isMut: false, isSigner: false },
        { name: "bet", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "escrowAuthority", isMut: false, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "userAta", isMut: true, isSigner: false },
        { name: "bettor", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "marketId", type: "string" }],
    },
  ],
  accounts: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "bump", type: "u8" },
          { name: "feeBps", type: "u16" },
          { name: "marketId", type: "string" },
          { name: "question", type: "string" },
          { name: "isClosed", type: "bool" },
          { name: "outcome", type: { option: { defined: "Outcome" } } },
          { name: "yesWagered", type: "u64" },
          { name: "noWagered", type: "u64" },
          { name: "marketDump", type: "u8" },
          { name: "escrowBump", type: "u8" },
          { name: "escrowAuthorityBump", type: "u8" },
        ],
      },
    },
    {
      name: "Bet",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "bump", type: "u8" },
          { name: "amount", type: "u64" },
          { name: "wageredOutcome", type: { defined: "MarketResolution" } },
          { name: "escrowFundsStatus", type: { defined: "BetEscrowFundsStatus" } },
        ],
      },
    },
  ],
  types: [
    {
      name: "MarketResolution",
      type: {
        kind: "enum",
        variants: [{ name: "Yes" }, { name: "No" }],
      },
    },
    {
      name: "Outcome",
      type: {
        kind: "enum",
        variants: [{ name: "Yes" }, { name: "No" }],
      },
    },
    {
      name: "BetEscrowFundsStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Funded" }, { name: "Withdrawn" }],
      },
    },
  ],
};
