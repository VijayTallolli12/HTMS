module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.spec.ts', '<rootDir>/apps/api-core/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@hms/api-contracts$': '<rootDir>/packages/api-contracts/src/index.ts',
        '^@hms/shared$': '<rootDir>/packages/shared/src/index.ts',
        '^@hms/database$': '<rootDir>/packages/database/src/index.ts',
        '^@hms/config$': '<rootDir>/packages/config/src/index.ts',
        '^@hms/ui$': '<rootDir>/packages/ui/src/index.ts',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@hms/api-contracts$': '<rootDir>/packages/api-contracts/src/index.ts',
        '^@hms/shared$': '<rootDir>/packages/shared/src/index.ts',
        '^@hms/database$': '<rootDir>/packages/database/src/index.ts',
        '^@hms/config$': '<rootDir>/packages/config/src/index.ts',
        '^@hms/ui$': '<rootDir>/packages/ui/src/index.ts',
      },
    },
  ],
};
