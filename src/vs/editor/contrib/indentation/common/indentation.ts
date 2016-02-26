/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import {TPromise} from 'vs/base/common/winjs.base';
import {INullService} from 'vs/platform/instantiation/common/instantiation';
import {EditorAction} from 'vs/editor/common/editorAction';
import {ICommonCodeEditor, IEditorActionDescriptorData} from 'vs/editor/common/editorCommon';
import {CommonEditorRegistry, EditorActionDescriptor} from 'vs/editor/common/editorCommonExtensions';
import {IndentationToSpacesCommand, IndentationToTabsCommand} from 'vs/editor/contrib/indentation/common/indentationCommands';
import {IQuickOpenService} from 'vs/workbench/services/quickopen/common/quickOpenService';

export class IndentationToSpacesAction extends EditorAction {
	static ID = 'editor.action.indentationToSpaces';

	constructor(descriptor: IEditorActionDescriptorData, editor: ICommonCodeEditor, @INullService ns) {
		super(descriptor, editor);
	}

	public run(): TPromise<boolean> {

		const command = new IndentationToSpacesCommand(this.editor.getSelection(), this.editor.getIndentationOptions().tabSize);
		this.editor.executeCommands(this.id, [command]);
		this.editor.updateOptions({
			insertSpaces: true
		});

		return TPromise.as(true);
	}
}

export class IndentationToTabsAction extends EditorAction {
	static ID = 'editor.action.indentationToTabs';

	constructor(descriptor: IEditorActionDescriptorData, editor: ICommonCodeEditor, @INullService ns) {
		super(descriptor, editor);
	}

	public run(): TPromise<boolean> {

		const command = new IndentationToTabsCommand(this.editor.getSelection(), this.editor.getIndentationOptions().tabSize);
		this.editor.executeCommands(this.id, [command]);
		this.editor.updateOptions({
			insertSpaces: false
		});

		return TPromise.as(true);
	}
}

export class ChangeIndentationSizeAction extends EditorAction {

	static ID = 'editor.action.changeIndentationSize';

	constructor(descriptor: IEditorActionDescriptorData, editor: ICommonCodeEditor, @IQuickOpenService private quickOpenService: IQuickOpenService) {
		super(descriptor, editor);
	}

	public run(): TPromise<boolean> {
		return TPromise.timeout(50 /* quick open is sensitive to being opened so soon after another */).then(() =>
			this.quickOpenService.pick(['1', '2', '3', '4', '5', '6', '7', '8'], { placeHolder: nls.localize('selectTabWidth', "Select Tab Width")}).then(pick => {
				this.editor.updateOptions({
					tabSize: parseInt(pick)
				});
				return true;
			})
		);
	}
}

// register actions
CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(IndentationToSpacesAction, IndentationToSpacesAction.ID, nls.localize('indentationToSpaces', "Convert Indentation to Spaces")));
CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(IndentationToTabsAction, IndentationToTabsAction.ID, nls.localize('indentationToTabs', "Convert Indentation to Tabs")));
CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(ChangeIndentationSizeAction, ChangeIndentationSizeAction.ID, nls.localize('changeIndentationSize', "Change Indentation Size")));
