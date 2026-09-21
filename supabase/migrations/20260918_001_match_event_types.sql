-- FOUL erzeugt das Cockpit seit jeher (MatchExecutionService.recordFoul), im CHECK stand es nie.
-- Folge: jeder Insert-Batch mit einem Foul scheiterte komplett (23514) und wurde verschluckt.
-- HALFTIME wird von einem späteren Task gebraucht (Halbzeit muss ein Ereignis sein).
ALTER TABLE public.match_events DROP CONSTRAINT match_events_type_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_type_check
  CHECK (type = ANY (ARRAY['GOAL','OWN_GOAL','YELLOW_CARD','YELLOW_RED_CARD','RED_CARD',
    'TIME_PENALTY','TIME_PENALTY_END','SUBSTITUTION','TIMEOUT','STATUS_CHANGE',
    'RESULT_EDIT','NOTE','FOUL','HALFTIME']));
