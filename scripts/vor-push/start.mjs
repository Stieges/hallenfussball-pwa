#!/usr/bin/env node
// Einstieg der Vor-Push-Prüfung (.husky/pre-push). Bewusst ohne Abfrage „bin ich das Hauptmodul?“: ein solcher
// Pfadvergleich scheiterte an Leerzeichen, Umlauten und Verknüpfungen und ließ den Push dann ungeprüft durch (Review #420).
import { starte } from './vor-push.mjs'

starte()
