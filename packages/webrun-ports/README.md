# @statewalker/webrun-ports

The `@statewalker/webrun-ports` JavaScript library provides a set of utilities for making asynchronous calls, sending and receiving async iterators over MessageChannel Ports. 

* [callPort](#callPort-method) - implements asynchronious port calls with timeout; (see the `listenPort` method)
* [errors](src/#errors) - contains serializeError/deserializeError methods transforming exceptions in JSON objects and restoring them back as Error instances 
* index.js the main entry point for the library; re-exports all defined methods
* [listenPort](#listenPort) - listens the specified port and delegates calls to  the registered handler; the methods are handled asynchronously and results delivered to the caller (see the `callPort` method)
* [recieve](#recieve) - transforms a sequence of calls to the specified port to an AsyncIterator; Internally uses the `recieveIterator` method. On the other side the the `send` method used to send an iterator. 
* [recieveIterator](#recieveIterator) - an adaptor method allowing to transform a sequence of calls to the `onMessage` method to an async iterator 
* [send](#send) - sends the specified async iterator over the specified port; Internally uses the `sendIterator` method. On the other side the `recieve` method handles calls. 
* [sendIterator](#sendIterator) - an utility method transforming an iterator to a sequence of calls to the registered handler.

## Methods

### `callPort` method

This function calls the specified port with the given payload.
- `port`: The name of the port to call.
- `payload`: The payload to send to the port.
Returns a promise that resolves when the port call is complete.

## errors

This file contains the following methods:

#### `serializeError(error)` method

This method takes an error object and transforms it into a JSON object.

#### `deserializeError(json)` method

This method takes a JSON object representing an error and restores it back as an Error instance.

### `listenPort` method

This function listens to the specified port and delegates calls to the registered handler. The methods are handled asynchronously and results are delivered to the caller.

- `port`: The name of the port to listen to.
- `handler`: The handler function that will be called when a method is invoked on the port.

### `recieveIterator` method

This function transforms a sequence of received messages from a specified port into an asynchronous iterator.

- `port`: The port number to listen to.
- `options`: Additional options for receiving messages (optional).

Returns an asynchronous generator that yields received messages.

### `send` method

Sends data from an async iterator to a specified port.

- `port`: The port to send the data to.
- `output`: The data to send.
- `options`: Additional options for sending the data.

Returns a promise that resolves when the data is received.

### `sendIterator` method

Sends values from an iterator to a specified function.

- `send`: The function sending values to the remote handlers.
- `it`: The iterator to send values from.

Returns a promise that resolves when the iterator is fully consumed.

## License

[MIT](https://choosealicense.com/licenses/mit/)

