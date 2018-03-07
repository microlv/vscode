/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument, CompletionList, CompletionItemKind, CompletionItem, TextEdit, Range, Position } from 'vscode-languageserver-types';
import { Proposed } from 'vscode-languageserver-protocol';
import * as path from 'path';
import * as fs from 'fs';
import URI from 'vscode-uri';
import { ICompletionParticipant } from 'vscode-html-languageservice/lib/htmlLanguageService';
import { startsWith } from '../utils/strings';
import { contains } from '../utils/arrays';

export function getPathCompletionParticipant(
	document: TextDocument,
	workspaceFolders: Proposed.WorkspaceFolder[] | undefined,
	result: CompletionList
): ICompletionParticipant {
	return {
		onHtmlAttributeValue: ({ tag, attribute, value, range }) => {

			if (shouldDoPathCompletion(tag, attribute, value)) {
				let workspaceRoot;

				if (startsWith(value, '/')) {
					if (!workspaceFolders || workspaceFolders.length === 0) {
						return;
					}

					workspaceRoot = resolveWorkspaceRoot(document, workspaceFolders);
				}

				const suggestions = providePathSuggestions(value, range, URI.parse(document.uri).fsPath, workspaceRoot);
				result.items = [...suggestions, ...result.items];
			}
		}
	};
}

function shouldDoPathCompletion(tag: string, attr: string, value: string): boolean {
	if (startsWith(value, 'http') || startsWith(value, 'https') || startsWith(value, '//')) {
		return false;
	}

	if (PATH_TAG_AND_ATTR[tag]) {
		if (typeof PATH_TAG_AND_ATTR[tag] === 'string') {
			return PATH_TAG_AND_ATTR[tag] === attr;
		} else {
			return contains(<string[]>PATH_TAG_AND_ATTR[tag], attr);
		}
	}

	return false;
}

export function providePathSuggestions(value: string, range: Range, activeDocFsPath: string, root?: string): CompletionItem[] {
	if (value.indexOf('/') === -1) {
		return [];
	}

	if (startsWith(value, '/') && !root) {
		return [];
	}

	const lastIndexOfSlash = value.lastIndexOf('/');
	const valueBeforeLastSlash = value.slice(0, lastIndexOfSlash + 1);
	const valueAfterLastSlash = value.slice(lastIndexOfSlash + 1);
	const parentDir = startsWith(value, '/')
		? path.resolve(root, '.' + valueBeforeLastSlash)
		: path.resolve(activeDocFsPath, '..', valueBeforeLastSlash);

	if (!fs.existsSync(parentDir)) {
		return [];
	}

	const replaceRange = getReplaceRange(range, valueAfterLastSlash);

	try {
		return fs.readdirSync(parentDir).map(f => {
			return {
				label: f,
				kind: isDir(path.resolve(parentDir, f)) ? CompletionItemKind.Folder : CompletionItemKind.File,
				textEdit: TextEdit.replace(replaceRange, f)
			};
		});
	} catch (e) {
		return [];
	}
}

const isDir = (p: string) => {
	return fs.statSync(p).isDirectory();
};

function resolveWorkspaceRoot(activeDoc: TextDocument, workspaceFolders: Proposed.WorkspaceFolder[]): string | undefined {
	for (let i = 0; i < workspaceFolders.length; i++) {
		if (startsWith(activeDoc.uri, workspaceFolders[i].uri)) {
			return path.resolve(URI.parse(workspaceFolders[i].uri).fsPath);
		}
	}
}

function getReplaceRange(valueRange: Range, valueAfterLastSlash: string): Range {
	const start = Position.create(valueRange.end.line, valueRange.end.character - 1 - valueAfterLastSlash.length);
	const end = Position.create(valueRange.end.line, valueRange.end.character - 1);
	return Range.create(start, end);
}

// Selected from https://stackoverflow.com/a/2725168/1780148
const PATH_TAG_AND_ATTR: { [tag: string]: string | string[] } = {
	// HTML 4
	a: 'href',
	body: 'background',
	del: 'cite',
	form: 'action',
	frame: ['src', 'longdesc'],
	img: ['src', 'longdesc'],
	ins: 'cite',
	link: 'href',
	object: 'data',
	q: 'cite',
	script: 'src',
	// HTML 5
	audio: 'src',
	button: 'formaction',
	command: 'icon',
	embed: 'src',
	html: 'manifest',
	input: 'formaction',
	source: 'src',
	track: 'src',
	video: ['src', 'poster']
};
