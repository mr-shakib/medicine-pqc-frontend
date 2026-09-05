import { TEAM } from '@/lib/team';

/**
 * Which team record is open, shared between the DOM and the WebGL layer.
 *
 * A module store rather than React context because the two layers are two
 * React trees: the canvas runs its own reconciler, and context does not cross
 * that boundary without a bridge. A store crosses it for free -- the registry
 * reads it inside `useFrame`, the dossier panel subscribes to it as an
 * external store -- and the frame loop never causes a re-render.
 *
 * There are two clocks in here on purpose. `index` and `open` are the discrete
 * facts the DOM needs and change only on a click. `amount` is the continuous
 * one the frame loop damps toward the target and reads sixty times a second;
 * it is what carries the record out of the ring and back into it.
 */
export interface DossierState {
  /**
   * The record being shown, or the one currently animating closed. Stays set
   * for the whole of the closing move, so the record has something to travel
   * back to; only cleared once `amount` reaches zero.
   */
  index: number;
  /** 1 while a record is open, 0 once it has been dismissed. */
  target: number;
  /** Damped toward `target`. 0 the record is in the ring, 1 it is the subject. */
  amount: number;
  /** Record under the pointer, or -1. Drives the hover lift and the cursor. */
  hover: number;
  /**
   * A record waiting for the open one to clear, or -1.
   *
   * Stepping from one record to the next inside the dossier cannot just swap
   * the index: the outgoing record would snap back into the ring and the
   * incoming one would appear already standing at the mark. The panel changes
   * its text at once, because that is what answers the click, and the 3D
   * dips -- the current record travels back to its station, and only then does
   * the next one leave for the mark.
   */
  pending: number;
  /**
   * The station the ring holds while a dossier is up.
   *
   * The turntable has to stop when a record leaves it -- a ring still turning
   * behind an open dossier reads as two things happening at once -- and the
   * scroll position it was turning with is not frozen, only ignored. It is
   * always the opened record's own index, so the registry turns to bring that
   * record to the front as the panel arrives, and the record has the front of
   * the ring to return to when it leaves. The blend runs both ways, so
   * closing hands the ring back to the scroll rather than snapping to it.
   */
  cursor: number;
}

export const dossierStore: DossierState = {
  index: -1,
  target: 0,
  amount: 0,
  hover: -1,
  pending: -1,
  cursor: 0,
};

/* -------------------------------------------------------------------------- */
/* Subscription -- for `useSyncExternalStore` on the DOM side                  */
/* -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

/**
 * The discrete snapshot, as ONE number carrying two facts.
 *
 * A panel that blanks the instant it is dismissed cannot animate out, so it
 * has to keep rendering the record it was showing until the transition
 * finishes -- which means the snapshot must say both "closed" and "closed on
 * whom". `useSyncExternalStore` needs a stable, comparable snapshot, so this
 * cannot be an object built per call: an open dossier is the record's own
 * index, and a closed one is `-1 - index`. Read it through the two helpers
 * below rather than testing the sign at the call site.
 */
let snapshot = -1;

/** True while the panel should be up. */
export const isDossierOpen = (snap: number): boolean => snap >= 0;

/** The record the panel is showing, open or on its way out. */
export const dossierRecord = (snap: number): number =>
  snap >= 0 ? snap : -1 - snap;

export function subscribeDossier(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getDossierSnapshot = (): number => snapshot;
/** The server renders nothing open; the URL is applied after hydration. */
export const getDossierServerSnapshot = (): number => -1;

function publish(next: number): void {
  if (snapshot === next) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/* -------------------------------------------------------------------------- */
/* Commands                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Open a record. `cursor` is the registry's current ring position, captured so
 * the turntable can hold still while the dossier is up.
 */
export function openDossier(index: number): void {
  if (index < 0 || index >= TEAM.length) return;
  dossierStore.index = index;
  dossierStore.pending = -1;
  dossierStore.cursor = index;
  dossierStore.target = 1;
  dossierStore.hover = -1;
  publish(index);
}

/**
 * Show a record, whether or not one is already open. Stepping between records
 * keeps the ring frozen where it was and hands the swap to the frame loop.
 */
export function showDossier(index: number): void {
  if (index < 0 || index >= TEAM.length || index === snapshot) return;
  if (!isDossierOpen(snapshot)) {
    openDossier(index);
    return;
  }
  dossierStore.cursor = index;
  dossierStore.pending = index;
  dossierStore.target = 0;
  publish(index);
}

export function closeDossier(): void {
  dossierStore.target = 0;
  dossierStore.pending = -1;
  publish(-1 - dossierRecord(snapshot));
}

/**
 * Called from the frame loop once a record has travelled back to its station:
 * either the next one takes the mark, or the registry stops treating any
 * record as special.
 */
export function settleDossier(): void {
  if (dossierStore.target !== 0) return;
  if (dossierStore.pending >= 0) {
    dossierStore.index = dossierStore.pending;
    dossierStore.pending = -1;
    dossierStore.target = 1;
    return;
  }
  dossierStore.index = -1;
}
