import {
    findCommandNode,
    isBranchNode,
    learnerDisplayLabel,
    type CommandNode,
} from '@/lib/command-registry';
import {
    childSchemaDefinitions,
    findDirectoryDefinition,
    findFieldDefinition,
    resolveFieldValue,
    toSchemaPath,
} from '@/lib/field-schema';
import type { InspectionBrief } from '@/types/workspace';

export type CompletionCount = {
  completed: number;
  total: number;
};

export type DirectoryCompletionChild = {
  token: string;
  label: string;
  path: string[];
  completed: number;
  total: number;
};

export type DirectoryCompletion = {
  title: string;
  path: string[];
  children: DirectoryCompletionChild[];
  completed: number;
  total: number;
};

/** A leaf participates in totals when required and not marked optional. */
export function isRequiredCompletionField(node: CommandNode): boolean {
  if (node.optional && node.required !== true) return false;
  if (node.required === false) return false;
  if (node.required === true) return true;
  return Boolean(node.requiresValue);
}

function fieldMetaForPath(brief: InspectionBrief, path: string[]) {
  const key = toSchemaPath(path);
  return brief.fieldMeta?.[key];
}

function buildCompletionNodeForSchemaPath(path: string[]): CommandNode | null {
  const directoryDefinition = findDirectoryDefinition(path);
  if (directoryDefinition) {
    const children = childSchemaDefinitions(path)
      .map((child) => buildCompletionNodeForSchemaPath(child.path))
      .filter((child): child is CommandNode => child !== null);
    return {
      token: directoryDefinition.token,
      label: directoryDefinition.label,
      description: directoryDefinition.description,
      children,
    };
  }

  const fieldDefinition = findFieldDefinition(path);
  if (!fieldDefinition) return null;

  return {
    token: fieldDefinition.token,
    label: fieldDefinition.label,
    description: fieldDefinition.description,
    requiresValue: true,
    fieldId: fieldDefinition.fieldId,
    required: fieldDefinition.required,
    optional: fieldDefinition.optional,
  };
}

/**
 * Required-leaf completion for a single field node against the live brief.
 * `notApplicable` fields are excluded from both sides of the count.
 * Invalid or empty values remain in `total` but not in `completed`.
 */
export function countRequiredField(
  node: CommandNode,
  path: string[],
  brief: InspectionBrief,
): CompletionCount {
  if (!isRequiredCompletionField(node)) {
    return { completed: 0, total: 0 };
  }

  const meta = fieldMetaForPath(brief, path);
  if (meta?.notApplicable) {
    return { completed: 0, total: 0 };
  }

  const fieldDefinition = node.fieldId
    ? findFieldDefinition(path)
    : null;
  const raw = fieldDefinition?.fieldId
    ? resolveFieldValue(brief, fieldDefinition.fieldId)
    : null;
  const trimmed = raw?.trim() ?? '';
  const isComplete = trimmed.length > 0 && !meta?.invalid;

  return {
    completed: isComplete ? 1 : 0,
    total: 1,
  };
}

/**
 * Recursive required-item count for a node and all descendants.
 * Branches contribute only through their required leaves.
 */
export function countNodeCompletion(
  node: CommandNode,
  path: string[],
  brief: InspectionBrief,
): CompletionCount {
  if (isBranchNode(node)) {
    let completed = 0;
    let total = 0;
    for (const child of node.children ?? []) {
      const childPath = [...path, child.token];
      const count = countNodeCompletion(child, childPath, brief);
      completed += count.completed;
      total += count.total;
    }
    return { completed, total };
  }

  return countRequiredField(node, path, brief);
}

/**
 * Whether a child appears as a directory completion row.
 * Capture directories and required fields are listed; bare terminal actions
 * such as `ready` are not.
 */
export function isCompletionDirectoryChild(node: CommandNode): boolean {
  if (isBranchNode(node)) return true;
  return isRequiredCompletionField(node);
}

/**
 * Shared directory completion projection. Both Power User and any future
 * consumer resolve counts here — never by hard-coding totals in the UI.
 */
export function resolveDirectoryCompletion(
  path: string[],
  brief: InspectionBrief,
): DirectoryCompletion | null {
  if (path.length === 0) return null;

  const node = findCommandNode(path);
  if (!node || !isBranchNode(node)) return null;

  const children: DirectoryCompletionChild[] = [];
  let completed = 0;
  let total = 0;

  for (const child of childSchemaDefinitions(path)) {
    if (child.kind !== 'field' && child.kind !== 'directory') continue;

    const childPath = child.path;
    const childNode = buildCompletionNodeForSchemaPath(childPath);
    if (!childNode) continue;

    const count = countNodeCompletion(childNode, childPath, brief);
    children.push({
      token: child.token,
      label: child.label,
      path: childPath,
      completed: count.completed,
      total: count.total,
    });
    completed += count.completed;
    total += count.total;
  }

  return {
    title: learnerDisplayLabel(node).toUpperCase(),
    path,
    children,
    completed,
    total,
  };
}
