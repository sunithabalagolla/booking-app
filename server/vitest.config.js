import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Starts one in-memory MongoDB replica set for the whole test run
    globalSetup: ['./tests/globalSetup.js'],
    // All test files share one test database, so run them one after another
    fileParallelism: false,
    // The first run downloads the MongoDB program, so give it time
    hookTimeout: 120000,
  },
})
