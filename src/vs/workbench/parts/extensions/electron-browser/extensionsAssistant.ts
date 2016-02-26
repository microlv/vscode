/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import Severity from 'vs/base/common/severity';
import {onUnexpectedError} from 'vs/base/common/errors';
import platform = require('vs/base/common/platform');
import { forEach } from 'vs/base/common/collections';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService } from 'vs/platform/message/common/message';
import { InstallAction } from 'vs/workbench/parts/extensions/electron-browser/extensionsActions';
import { IExtensionsService, IGalleryService } from 'vs/workbench/parts/extensions/common/extensions';
import { IEventService } from 'vs/platform/event/common/event';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { EventType, EditorEvent } from 'vs/workbench/common/events';
import { getUntitledOrFileResource } from 'vs/workbench/common/editor';
import { IDebugService, ServiceEvents } from 'vs/workbench/parts/debug/common/debug';
import { match } from 'vs/base/common/glob';

// --- check for extensions we don't bundle by default anymore but the user might expect

interface LegacyExtensionChecker {
	(accessor: ServicesAccessor, callback: Function): any;
}

function omnisharpChecker(accessor, callback) {

	const subscription = accessor.get(IEventService).addListener2(EventType.EDITOR_INPUT_CHANGED, (e: EditorEvent) => {
		if (!e.editor || !e.editor.input) {
			return;
		}
		const uri = getUntitledOrFileResource(e.editor.input);
		if (!uri) {
			return;
		}
		if (match('{**/*.cs,**/project.json,**/global.json,**/*.csproj,**/*.sln}', uri.fsPath)) {
			subscription.dispose();
			callback();
		}
	});
}

function monoDebugChecker(accessor, callback) {
	const debugService = (<IDebugService>accessor.get(IDebugService));
	const subscription = debugService.addListener2(ServiceEvents.TYPE_NOT_SUPPORTED, (type: string) => {
		// mono debugging is not supported on windows, so do not offer an extension install if on windows
		if (type === 'mono' && !platform.isWindows) {
			subscription.dispose();
			callback();
		}
	});
}

const extensionChecker: { [id: string]: LegacyExtensionChecker } = Object.create(null);
extensionChecker['ms-vscode.csharp'] = omnisharpChecker;
extensionChecker['ms-vscode.mono-debug'] = monoDebugChecker;

export function checkForLegacyExtensionNeeds(accessor: ServicesAccessor): void {

	const instantiationService = accessor.get(IInstantiationService);
	const extensionService = accessor.get(IExtensionsService);
	const storageService = accessor.get(IStorageService);
	const messageService = accessor.get(IMessageService);
	const availableExtensions = accessor.get(IGalleryService).query();

	extensionService.getInstalled().then(extensions => {

		// in case of manual installation
		for (let ext of extensions) {
			delete extensionChecker[`${ext.publisher}.${ext.name}`];
		}

		forEach(extensionChecker, entry => {

			// check if we asked already once
			const key = `extensionsAssistant/legacy/${entry.key}`;
			const value = storageService.get(key, StorageScope.GLOBAL);
			if (value) {
				return;
			}

			instantiationService.invokeFunction(entry.value, () => {

				availableExtensions.then(extensions => {
					for (let ext of extensions) {
						if (`${ext.publisher}.${ext.name}` === entry.key) {
							return ext;
						}
					}
				}).then(extension => {
					if (!extension) {
						return;
					}

					let message = nls.localize('hint', "'{0}' is now an extension. Would you like to install it?", extension.displayName);
					let actions = [
						new Action('ext.later', nls.localize('later', "Later"), undefined, true, () => TPromise.as(true)),
						new Action('ext.no', nls.localize('no', "No"), undefined, true, () => {
							storageService.store(key, 'OK', StorageScope.GLOBAL);
							return TPromise.as(true);
						}),
						new Action('ext.install', nls.localize('yes', "Yes"), undefined, undefined, () => {
							let actualInstall = instantiationService.createInstance(InstallAction, nls.localize('yes', "Yes"));
							actualInstall.run(extension);
							return TPromise.as(true).then(() => {
								messageService.hideAll();
								messageService.show(Severity.Info, nls.localize('extensionsInstalled', "Extension '{0}' is being installed...", extension.displayName));
							});
						})
					];

					// inform user and remember
					messageService.show(Severity.Info, { message, actions });

				}, onUnexpectedError);
			});
		});
	});
}
