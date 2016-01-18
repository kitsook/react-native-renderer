import {ReactNativeWrapper} from './wrapper';
import {NgZone} from 'angular2/core';
import {Hammer} from './hammer';

export var nodeMap: Map<number, Node> = new Map<number, Node>();

export abstract class Node {
  public parent: Node;
  public children: Node[] = [];
  public tagName: string = "";
  public properties: {[s: string]: any } = {};

  public nativeTag: number = -1;
  public isCreated: boolean = false;
  public nativeChildren: Array<number> = [];

  public eventListeners: Map<string, Array<Function>> = new Map<string, Array<Function>>();
  private _hammer: any = null;

  constructor(public rnWrapper: ReactNativeWrapper, public zone: NgZone) {}

  attachTo(parent: Node): void {
    if (parent) {
      parent.children.push(this);
      this.parent = parent;
    }
  }
  attachToAt(parent: Node, index: number): void {
    if (parent) {
      parent.children.splice(index, 0, this);
      this.parent = parent;
    }
  }

  getInsertionNativeIndex(): number {
    var nativeIndex = -1;
    if (this.parent) {
      var index = this.parent.children.indexOf(this);
      var count = index;
      while (count >= 0) {
        var prev = this.parent.children[count];
        if (prev.nativeTag > -1) {
          nativeIndex = this.parent.nativeChildren.indexOf(prev.nativeTag);
          count = 0;
        }
        count--;
      }
    }
    return nativeIndex + 1;
  }

  destroyNative() {
    this.isCreated = false;
    nodeMap.delete(this.nativeTag);
    this.nativeTag = -1;
    this.nativeChildren = [];
    for (var i = 0; i < this.children.length; i++) {
      this.children[i].destroyNative();
    }
  }

  setProperty(name: string, value: any, updateNative: boolean = true) {
    this.properties[name] = value;
    if (updateNative && this.nativeTag > -1) {
      var prop = {};
      prop[name] = value;
      this.rnWrapper.updateView(this.nativeTag, this.tagName, prop);
    }
  }

  addEventListener(eventName: string, handler: Function) {
    if (!Hammer.supports(eventName)) {
      if (!this.eventListeners.has(eventName)) {
        this.eventListeners.set(eventName, []);
      }
      var handlers = this.eventListeners.get(eventName);
      handlers.push(handler);
      this.eventListeners.set(eventName, handlers);
    }
    else {
      if (this._hammer == null) {
        this._hammer = Hammer.create(this);
      }
      Hammer.add(this._hammer, eventName, handler);
    }
  }

  removeEventListener(eventName: string, handler: Function) {
    if (!Hammer.supports(eventName)) {
      var handlers = this.eventListeners.get(eventName);
      if (handlers) {
        var index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          this.eventListeners.set(eventName, handlers);
        }
      }
    } else {
      this._hammer = Hammer.remove(this._hammer, eventName, handler);
    }
  }

  fireEvent(name: string, event: any) {
    event.currentTarget = this;
    var handlers = this.eventListeners.get(name);
    if (handlers) {
      handlers.forEach((handler) => {
        this.zone.run(() => handler(event));
      });
    }
    if (this.parent && !event._stop) {
      this.parent.fireEvent(name, event);
    }
  }

  //TODO: generalize this TextInput specific code
  focus() {
    this.rnWrapper.dispatchCommand(this.nativeTag, 'focusTextInput', null);
  }
  blur() {
    this.rnWrapper.dispatchCommand(this.nativeTag, 'blurTextInput', null);
  }

  dispatchCommand(command: string, params: any = null) {
    this.rnWrapper.dispatchCommand(this.nativeTag, command, params);
  }
}

export class ElementNode extends Node {
  constructor(public tagName: string, wrapper: ReactNativeWrapper, zone: NgZone) {
    super(wrapper, zone);
  }
}

export class TextNode extends Node {
  constructor(value: string, wrapper: ReactNativeWrapper, zone: NgZone) {
    super(wrapper, zone);
    this.tagName = 'RawText';
    this.setText(value);
  }

  setText(text: string): string {
    var trimmedText = text ? text.trim() : '';
    this.setProperty('text', trimmedText, false);
    return trimmedText;
  }
}

export class AnchorNode extends Node {
  constructor(wrapper: ReactNativeWrapper, zone: NgZone) { super(wrapper, zone);}
}

export class InertNode extends Node {
  constructor(wrapper: ReactNativeWrapper, zone: NgZone) { super(wrapper, zone);}
}