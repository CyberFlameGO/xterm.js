/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions, ITerminalAddon, IDisposable, IViewportRange } from 'xterm';
import { WebLinkProvider } from './WebLinkProvider';

const protocolClause = '(https?:\\/\\/)';
const domainCharacterSet = '[\\da-z\\.-]+';
const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
const domainBodyClause = '(' + domainCharacterSet + ')';
const tldClause = '([a-z\\.]{2,6})';
const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
const localHostClause = '(localhost)';
const portClause = '(:\\d{1,5})';
const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + '|' + localHostClause + ')' + portClause + '?';
const pathCharacterSet = '(\\/[\\/\\w\\.\\-%~:+@]*)*([^:"\'\\s])';
const pathClause = '(' + pathCharacterSet + ')?';
const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;~\\=\\.\\-]*';
const queryStringClause = '(\\?' + queryStringHashFragmentCharacterSet + ')?';
const hashFragmentClause = '(#' + queryStringHashFragmentCharacterSet + ')?';
const negatedPathCharacterSet = '[^\\/\\w\\.\\-%]+';
const bodyClause = hostClause + pathClause + queryStringClause + hashFragmentClause;
const start = '(?:^|' + negatedDomainCharacterSet + ')(';
const end = ')($|' + negatedPathCharacterSet + ')';
const strictUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

function handleLink(event: MouseEvent, uri: string): void {
  const newWindow = window.open();
  if (newWindow) {
    try {
      newWindow.opener = null;
    } catch {
      // no-op, Electron can throw
    }
    newWindow.location.href = uri;
  } else {
    console.warn('Opening link blocked as opener could not be cleared');
  }
}

interface ILinkProviderOptions {
  hover?(event: MouseEvent, text: string, location: IViewportRange): void;
  leave?(event: MouseEvent, text: string): void;
}

export class WebLinksAddon implements ITerminalAddon {
  private _linkMatcherId: number | undefined;
  private _terminal: Terminal | undefined;
  private _linkProvider: IDisposable | undefined;

  constructor(
    private _handler: (event: MouseEvent, uri: string) => void = handleLink,
    private _options: ILinkMatcherOptions | ILinkProviderOptions = {},
    private _useLinkProvider: boolean = false
  ) {
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;

    if (this._useLinkProvider && 'registerLinkProvider' in this._terminal) {
      const options = this._options as ILinkProviderOptions;
      this._linkProvider = this._terminal.registerLinkProvider(new WebLinkProvider(this._terminal, strictUrlRegex, this._handler, options));
    } else {
      // TODO: This should be removed eventually
      const options = this._options as ILinkMatcherOptions;
      options.matchIndex = 1;
      this._linkMatcherId = (this._terminal as Terminal).registerLinkMatcher(strictUrlRegex, this._handler, options);
    }
  }

  public dispose(): void {
    if (this._linkMatcherId !== undefined && this._terminal !== undefined) {
      this._terminal.deregisterLinkMatcher(this._linkMatcherId);
    }

    this._linkProvider?.dispose();
  }
}
