/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainContext, MainThreadWebviewsShape, IMainContext, ExtHostWebviewsShape, WebviewHandle } from './extHost.protocol';
import * as vscode from 'vscode';
import Event, { Emitter } from 'vs/base/common/event';
import * as typeConverters from 'vs/workbench/api/node/extHostTypeConverters';
import { Position } from 'vs/platform/editor/common/editor';
import { TPromise } from 'vs/base/common/winjs.base';

export class ExtHostWebview implements vscode.Webview {
	public readonly editorType = 'webview';

	private _title: string;
	private _html: string;
	private _options: vscode.WebviewOptions;
	private _isDisposed: boolean = false;
	private _viewColumn: vscode.ViewColumn;

	public readonly onMessageEmitter = new Emitter<any>();
	public readonly onDidReceiveMessage: Event<any> = this.onMessageEmitter.event;

	public readonly onDisposeEmitter = new Emitter<void>();
	public readonly onDidDispose: Event<void> = this.onDisposeEmitter.event;

	public readonly onDidChangeViewColumnEmitter = new Emitter<vscode.ViewColumn>();
	public readonly onDidChangeViewColumn: Event<vscode.ViewColumn> = this.onDidChangeViewColumnEmitter.event;

	constructor(
		private readonly _handle: WebviewHandle,
		private readonly _proxy: MainThreadWebviewsShape,
		private readonly _uri: vscode.Uri,
		viewColumn: vscode.ViewColumn,
		options: vscode.WebviewOptions
	) {
		this._viewColumn = viewColumn;
		this._options = options;
	}

	public dispose() {
		if (this._isDisposed) {
			return;
		}

		this._isDisposed = true;
		this._proxy.$disposeWebview(this._handle);

		this.onDisposeEmitter.dispose();
		this.onMessageEmitter.dispose();
		this.onDidChangeViewColumnEmitter.dispose();
	}

	get uri(): vscode.Uri {
		this.assertNotDisposed();
		return this._uri;
	}

	get title(): string {
		this.assertNotDisposed();
		return this._title;
	}

	set title(value: string) {
		this.assertNotDisposed();
		if (this._title !== value) {
			this._title = value;
			this._proxy.$setTitle(this._handle, value);
		}
	}

	get html(): string {
		this.assertNotDisposed();
		return this._html;
	}

	set html(value: string) {
		this.assertNotDisposed();
		if (this._html !== value) {
			this._html = value;
			this._proxy.$setHtml(this._handle, value);
		}
	}

	get options(): vscode.WebviewOptions {
		this.assertNotDisposed();
		return this._options;
	}

	get viewColumn(): vscode.ViewColumn {
		this.assertNotDisposed();
		return this._viewColumn;
	}

	set viewColumn(value: vscode.ViewColumn) {
		this.assertNotDisposed();
		this._viewColumn = value;
	}

	public postMessage(message: any): Thenable<boolean> {
		return this._proxy.$sendMessage(this._handle, message);
	}

	public show(viewColumn: vscode.ViewColumn): void {
		this._proxy.$show(this._handle, typeConverters.fromViewColumn(viewColumn));
	}

	private assertNotDisposed() {
		if (this._isDisposed) {
			throw new Error('Webview is disposed');
		}
	}
}

export class ExtHostWebviews implements ExtHostWebviewsShape {
	private static handlePool = 0;

	private readonly _proxy: MainThreadWebviewsShape;

	private readonly _webviews = new Map<WebviewHandle, ExtHostWebview>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadWebviews);
	}

	createWebview(
		uri: vscode.Uri,
		title: string,
		viewColumn: vscode.ViewColumn,
		options: vscode.WebviewOptions
	): vscode.Webview {
		const handle = ExtHostWebviews.handlePool++;
		this._proxy.$createWebview(handle, uri, title, typeConverters.fromViewColumn(viewColumn), options);

		const webview = new ExtHostWebview(handle, this._proxy, uri, viewColumn, options);
		this._webviews.set(handle, webview);
		return webview;
	}

	$onMessage(handle: WebviewHandle, message: any): void {
		const webview = this.getWebview(handle);
		if (webview) {
			webview.onMessageEmitter.fire(message);
		}
	}

	$onDidChangeActiveWeview(handle: WebviewHandle | undefined): void {
		this._onDidChangeActiveWebview.fire(this.getWebview(handle));
	}

	$onDidDisposeWeview(handle: WebviewHandle): Thenable<void> {
		const webview = this.getWebview(handle);
		if (webview) {
			webview.onDisposeEmitter.fire();
			this._webviews.delete(handle);
		}
		return TPromise.as(void 0);
	}

	$onDidChangePosition(handle: WebviewHandle, newPosition: Position): void {
		const webview = this.getWebview(handle);
		if (webview) {
			const newViewColumn = typeConverters.toViewColumn(newPosition);
			if (webview.viewColumn !== newViewColumn) {
				webview.viewColumn = newViewColumn;
				webview.onDidChangeViewColumnEmitter.fire(newViewColumn);
			}
		}
	}

	private readonly _onDidChangeActiveWebview = new Emitter<ExtHostWebview | undefined>();
	public readonly onDidChangeActiveWebview = this._onDidChangeActiveWebview.event;

	private getWebview(handle: WebviewHandle) {
		return this._webviews.get(handle);
	}
}