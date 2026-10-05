/**
 * Collection Picker Modal — pure state machine
 *
 * Defines all state phases and events for the modal, plus a `transition`
 * function that is a pure function: given a current state and an event it
 * returns the next state without any side-effects.
 *
 * Requirements: 6.1–6.10
 */

import type { Collection, PostMetadata } from '../shared/types/domain';

// ── State types ──────────────────────────────────────────────────────────────

export type ModalPhase =
  | { phase: 'CLOSED' }
  | { phase: 'LOADING'; meta: Partial<PostMetadata> }
  | { phase: 'IDLE'; meta: Partial<PostMetadata>; collections: Collection[]; selectedId: string | null }
  | { phase: 'CREATING'; meta: Partial<PostMetadata>; collections: Collection[]; selectedId: string | null; inputValue: string }
  | { phase: 'VALIDATION_ERROR'; meta: Partial<PostMetadata>; collections: Collection[]; selectedId: string | null; inputValue: string; errorMsg: string }
  | { phase: 'SAVING'; meta: Partial<PostMetadata>; collections: Collection[]; selectedId: string }
  | { phase: 'SAVE_ERROR'; meta: Partial<PostMetadata>; collections: Collection[]; selectedId: string | null; error: string }
  | { phase: 'FETCH_ERROR'; meta: Partial<PostMetadata>; error: string };

// ── Event types ──────────────────────────────────────────────────────────────

export type ModalEvent =
  | { type: 'OPEN'; meta: Partial<PostMetadata> }
  | { type: 'COLLECTIONS_LOADED'; collections: Collection[] }
  | { type: 'COLLECTIONS_FAILED'; error: string }
  | { type: 'SELECT_COLLECTION'; id: string }
  | { type: 'CONFIRM_SAVE' }
  | { type: 'START_CREATE' }
  | { type: 'INPUT_CHANGED'; value: string }
  | { type: 'SUBMIT_CREATE' }
  | { type: 'CANCEL_CREATE' }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; error: string }
  | { type: 'DISMISS_ERROR' }
  | { type: 'RETRY' }
  | { type: 'CLOSE' };

// ── Pure transition function ─────────────────────────────────────────────────

/**
 * Pure state machine transition function.
 *
 * For any (state, event) pair not listed in the transition table the current
 * state is returned unchanged — unknown events are silently ignored so callers
 * never need to guard against impossible combinations.
 *
 * Requirements: 6.1–6.10
 */
export function transition(state: ModalPhase, event: ModalEvent): ModalPhase {
  switch (state.phase) {
    // ── CLOSED ──────────────────────────────────────────────────────────────
    case 'CLOSED':
      // Requirement 6.1: CLOSED + OPEN → LOADING
      if (event.type === 'OPEN') {
        return { phase: 'LOADING', meta: event.meta };
      }
      return state;

    // ── LOADING ─────────────────────────────────────────────────────────────
    case 'LOADING':
      // Requirement 6.2: LOADING + COLLECTIONS_LOADED → IDLE (selectedId: null)
      if (event.type === 'COLLECTIONS_LOADED') {
        return {
          phase: 'IDLE',
          meta: state.meta,
          collections: event.collections,
          selectedId: null,
        };
      }
      // Requirement 6.3: LOADING + COLLECTIONS_FAILED → FETCH_ERROR
      if (event.type === 'COLLECTIONS_FAILED') {
        return { phase: 'FETCH_ERROR', meta: state.meta, error: event.error };
      }
      return state;

    // ── IDLE ─────────────────────────────────────────────────────────────────
    case 'IDLE':
      // Requirement 6.4: IDLE + SELECT_COLLECTION → IDLE (update selectedId)
      if (event.type === 'SELECT_COLLECTION') {
        return { ...state, selectedId: event.id };
      }
      // Requirement 6.5: IDLE + CONFIRM_SAVE (selectedId !== null) → SAVING
      if (event.type === 'CONFIRM_SAVE') {
        if (state.selectedId !== null) {
          return {
            phase: 'SAVING',
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
          };
        }
        // Requirement 6.6: IDLE + CONFIRM_SAVE (selectedId === null) → IDLE unchanged
        return state;
      }
      // Requirement 6.7: IDLE + START_CREATE → CREATING (inputValue: '')
      if (event.type === 'START_CREATE') {
        return {
          phase: 'CREATING',
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          inputValue: '',
        };
      }
      // Requirement 6.8: IDLE + CLOSE → CLOSED
      if (event.type === 'CLOSE') {
        return { phase: 'CLOSED' };
      }
      return state;

    // ── CREATING ─────────────────────────────────────────────────────────────
    case 'CREATING':
      // Requirement 6.9: CREATING + INPUT_CHANGED → CREATING (update inputValue)
      if (event.type === 'INPUT_CHANGED') {
        return { ...state, inputValue: event.value };
      }
      // Requirement 6.9: CREATING + CANCEL_CREATE → IDLE
      if (event.type === 'CANCEL_CREATE') {
        return {
          phase: 'IDLE',
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
        };
      }
      // Requirement 6.10: CREATING + SUBMIT_CREATE → VALIDATION_ERROR or SAVING
      if (event.type === 'SUBMIT_CREATE') {
        const trimmed = state.inputValue.trim();
        // Reject empty or whitespace-only input
        if (!trimmed) {
          return {
            phase: 'VALIDATION_ERROR',
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
            inputValue: state.inputValue,
            errorMsg: 'Collection name cannot be empty',
          };
        }
        // Reject names longer than 100 characters
        if (state.inputValue.length > 100) {
          return {
            phase: 'VALIDATION_ERROR',
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
            inputValue: state.inputValue,
            errorMsg: 'Name must be 100 characters or fewer',
          };
        }
        // Valid name — BSW will create the collection then save the post
        return {
          phase: 'SAVING',
          meta: state.meta,
          collections: state.collections,
          selectedId: '__new__',
        };
      }
      return state;

    // ── VALIDATION_ERROR ─────────────────────────────────────────────────────
    case 'VALIDATION_ERROR':
      // Requirement 6.10: VALIDATION_ERROR + INPUT_CHANGED → CREATING
      if (event.type === 'INPUT_CHANGED') {
        return {
          phase: 'CREATING',
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          inputValue: event.value,
        };
      }
      return state;

    // ── SAVING ───────────────────────────────────────────────────────────────
    case 'SAVING':
      // Requirement 6.1: SAVING + SAVE_SUCCEEDED → CLOSED
      if (event.type === 'SAVE_SUCCEEDED') {
        return { phase: 'CLOSED' };
      }
      // Requirement 6.1: SAVING + SAVE_FAILED → SAVE_ERROR
      if (event.type === 'SAVE_FAILED') {
        return {
          phase: 'SAVE_ERROR',
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          error: event.error,
        };
      }
      return state;

    // ── SAVE_ERROR ───────────────────────────────────────────────────────────
    case 'SAVE_ERROR':
      // Requirement 6.1: SAVE_ERROR + DISMISS_ERROR → IDLE
      if (event.type === 'DISMISS_ERROR') {
        return {
          phase: 'IDLE',
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
        };
      }
      return state;

    // ── FETCH_ERROR ──────────────────────────────────────────────────────────
    case 'FETCH_ERROR':
      // Requirement 6.1: FETCH_ERROR + RETRY → LOADING
      if (event.type === 'RETRY') {
        return { phase: 'LOADING', meta: state.meta };
      }
      // Requirement 6.1: FETCH_ERROR + CLOSE → CLOSED
      if (event.type === 'CLOSE') {
        return { phase: 'CLOSED' };
      }
      return state;

    default: {
      // TypeScript exhaustiveness check — unreachable at runtime
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
