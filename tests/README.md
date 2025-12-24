How to run tests locally:

1. Start the Node server in a separate terminal (simulation mode is fine):
   SIMULATE=1 npm start
2. In another terminal run the deterministic simulator to push events into the server (it will connect to ws://localhost:8080 by default):
   npm run simulate:events
3. Run the node-ws-test to ensure the server re-broadcasts messages to connected clients:
   npm test

CI note: In CI, start the server in background and run `npm run simulate:events` then `npm test` as smoke tests.
