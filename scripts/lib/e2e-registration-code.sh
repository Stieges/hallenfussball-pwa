#!/usr/bin/env bash
#
# e2e-registration-code.sh — einzige Quelle für den lokalen `E2E_REGISTRATION_CODE`.
#
# Task T2 (.superpowers/sdd/2026-09-24-testumgebung/task-T2-brief.md, Vorspann/Ruling O):
# `supabase/functions/.env` darf nicht angelegt werden (Repo-Hook blockt `.env`-Pfade
# bewusst, siehe task-T1-report.md). Stattdessen liest `supabase/config.toml`
# ([edge_runtime.secrets] REGISTRATION_CODE = "env(E2E_REGISTRATION_CODE)") diese
# Prozess-Variable beim Start des edge-runtime-Containers. `npm run test:env:up`/
# `test:env:reset` sourcen dieses Skript, bevor sie `supabase start`/`db reset` aufrufen.
#
# Der TS-seitige Zwilling ist `E2E_REGISTRATION_CODE` in `tests/e2e/cloud/testData.ts` —
# beide MÜSSEN denselben Wert tragen (geprüft von
# `tests/e2e/cloud/__tests__/registrationCodeParity.test.ts`). Fester Testwert, kein
# echtes Geheimnis; darf NIE als Produktions-Secret verwendet werden.

export E2E_REGISTRATION_CODE="E2E-LOCAL-CODE-NICHT-PRODUKTIV"
