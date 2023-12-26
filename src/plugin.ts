import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { TodoistMonitor } from "./actions/todoist-monitor";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the increment action.
streamDeck.actions.registerAction(new TodoistMonitor());

// Finally, connect to the Stream Deck.
streamDeck.connect();
