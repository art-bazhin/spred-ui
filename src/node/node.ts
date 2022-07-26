import { isSignal, Signal } from 'spred';
import { addSub, createMark, insertBefore, removeNodes } from '../dom/dom';
import { next, state } from '../state/state';

export function node(binding: Node | Signal<Node>) {
  if (state.isCreating && state.root) {
    const mark = createMark();

    state.path += 'fbp';
    state.setupQueue.push(() => setupNode(binding, mark));
    state.root.appendChild(mark);

    return;
  }

  next();

  const pathState = state.pathState;
  const mark = pathState && pathState.node;

  setupNode(binding, mark);

  next();
}

function setupNode(binding: Node | Signal<Node>, mark: Node | null) {
  if (!mark) return;

  if (isSignal(binding)) {
    let start = mark.previousSibling;

    if (!start) {
      start = createMark();
      insertBefore(start, mark);
    }

    addSub(
      mark,
      binding.subscribe((node) => {
        removeNodes(start!.nextSibling, mark);
        insertBefore(node, mark);
      })
    );

    return;
  }

  insertBefore(binding, mark);
}
