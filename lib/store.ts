import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { commandReducer } from "./engine";
import { createInitialState } from "./fixtures";
import type { Command, MadeThisState } from "./types";

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const databasePath = process.env.MADETHIS_DB_PATH ?? path.join(dataDirectory, "madethis-cmo.sqlite");

const globalDatabase = globalThis as typeof globalThis & {
  madeThisDatabase?: Database.Database;
};

const database = globalDatabase.madeThisDatabase ?? new Database(databasePath);
if (process.env.NODE_ENV !== "production") globalDatabase.madeThisDatabase = database;

database.pragma("journal_mode = WAL");
database.pragma("busy_timeout = 3000");
database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const readStatement = database.prepare("SELECT state_json FROM app_state WHERE id = 1");
const writeStatement = database.prepare(`
  INSERT INTO app_state (id, schema_version, state_json, updated_at)
  VALUES (1, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    schema_version = excluded.schema_version,
    state_json = excluded.state_json,
    updated_at = excluded.updated_at
`);

function writeState(state: MadeThisState) {
  writeStatement.run(JSON.stringify(state), new Date().toISOString());
}

function normalizeState(state: MadeThisState): MadeThisState {
  state.marketingPlans ??= [];
  return state;
}

export function getState(): MadeThisState {
  const row = readStatement.get() as { state_json: string } | undefined;
  if (!row) {
    const initial = createInitialState();
    writeState(initial);
    return initial;
  }
  return normalizeState(JSON.parse(row.state_json) as MadeThisState);
}

const executeCommand = database.transaction((command: Command) => {
  const current = getState();
  const next = commandReducer(current, command);
  writeState(next);
  return next;
});

export function dispatch(command: Command) {
  return executeCommand.immediate(command);
}
