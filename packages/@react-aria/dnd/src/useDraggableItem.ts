/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {AriaButtonProps} from '@react-types/button';
import {clearGlobalDnDState, isInternalDropOperation, setDraggingKeys} from './utils';
import {DraggableCollectionState} from '@react-stately/dnd';
import {HTMLAttributes, Key} from 'react';
// @ts-ignore
import intlMessages from '../intl/*.json';
import {useDescription} from '@react-aria/utils';
import {useDrag} from './useDrag';
import {useDragModality} from './utils';
import {useLocalizedStringFormatter} from '@react-aria/i18n';

export interface DraggableItemProps {
  /** The key of the draggable item within the collection. */
  key: Key,
  /**
   * Whether the item has an explicit focusable drag affordance to initiate accessible drag and drop mode.
   * If true, the dragProps will omit these event handlers, and they will be applied to dragButtonProps instead.
   */
  hasDragButton?: boolean,
  /**
   * Whether the item has a primary action (e.g. Enter key or long press) that would
   * conflict with initiating accessible drag and drop. If true, the Alt key must be held to
   * start dragging with a keyboard, and long press is disabled until selection mode is entered.
   * This should be passed from the associated collection item hook (e.g. useOption, useGridListItem, etc.).
   */
  hasAction?: boolean
}

export interface DraggableItemResult {
  dragProps: HTMLAttributes<HTMLElement>,
  dragButtonProps: AriaButtonProps
}

const MESSAGES = {
  keyboard: {
    selected: 'dragSelectedKeyboard',
    notSelected: 'dragDescriptionKeyboard'
  },
  touch: {
    selected: 'dragSelectedLongPress',
    notSelected: 'dragDescriptionLongPress'
  },
  virtual: {
    selected: 'dragDescriptionVirtual',
    notSelected: 'dragDescriptionVirtual'
  }
};

export function useDraggableItem(props: DraggableItemProps, state: DraggableCollectionState): DraggableItemResult {
  let stringFormatter = useLocalizedStringFormatter(intlMessages);
  let isDisabled = state.selectionManager.isDisabled(props.key);
  let {dragProps, dragButtonProps} = useDrag({
    getItems() {
      return state.getItems(props.key);
    },
    preview: state.preview,
    getAllowedDropOperations: state.getAllowedDropOperations,
    hasDragButton: props.hasDragButton,
    onDragStart(e) {
      state.startDrag(props.key, e);
      // Track draggingKeys for useDroppableCollection's default onDrop handler and useDroppableCollectionState's default getDropOperation
      setDraggingKeys(state.draggingKeys);
    },
    onDragMove(e) {
      state.moveDrag(e);
    },
    onDragEnd(e) {
      let {dropOperation} = e;
      let isInternal = dropOperation === 'cancel' ? false : isInternalDropOperation();
      state.endDrag({...e, keys: state.draggingKeys, isInternal});
      clearGlobalDnDState();
    }
  });

  let item = state.collection.getItem(props.key);
  let numKeysForDrag = state.getKeysForDrag(props.key).size;
  let isSelected = numKeysForDrag > 1 && state.selectionManager.isSelected(props.key);
  let dragButtonLabel: string;
  let description: string;

  // Override description to include selected item count.
  let modality = useDragModality();
  if (!props.hasDragButton) {
    let msg = MESSAGES[modality][isSelected ? 'selected' : 'notSelected'];
    if (props.hasAction && modality === 'keyboard') {
      msg += 'Alt';
    }

    if (isSelected) {
      description = stringFormatter.format(msg, {count: numKeysForDrag});
    } else {
      description = stringFormatter.format(msg);
    }
  } else {
    if (isSelected) {
      dragButtonLabel = stringFormatter.format('dragSelectedItems', {count: numKeysForDrag});
    } else {
      dragButtonLabel = stringFormatter.format('dragItem', {itemText: item?.textValue ?? ''});
    }
  }

  let descriptionProps = useDescription(description);
  if (description) {
    Object.assign(dragProps, descriptionProps);
  }

  if (!props.hasDragButton && props.hasAction) {
    let {onKeyDownCapture, onKeyUpCapture} = dragProps;
    if (modality === 'touch') {
      // Remove long press description if an action is present, because in that case long pressing selects the item.
      delete dragProps['aria-describedby'];
    }

    // Require Alt key if there is a conflicting action.
    dragProps.onKeyDownCapture = e => {
      if (e.altKey) {
        onKeyDownCapture(e);
      }
    };

    dragProps.onKeyUpCapture = e => {
      if (e.altKey) {
        onKeyUpCapture(e);
      }
    };
  }

  return {
    dragProps: isDisabled ? {} : dragProps,
    dragButtonProps: {
      ...dragButtonProps,
      isDisabled,
      'aria-label': dragButtonLabel
    }
  };
}
