# @statewalker/webrun-ports


The `@statewalker/webrun-ports` JavaScript library offers a set of utilities designed for handling asynchronous calls and managing the exchange of data streams through `MessageChannel` Ports.

This library enables the initiation of calls and receipt of responses across bidirectional channels, utilizing `MessagePort` instances provided by `MessageChannel`. The methods in this library guarantee that each call is either processed or rejected, ensuring no indefinite hangs. In cases where the peer fails to handle the request appropriately or if the request exceeds a specified time limit, a timeout exception is raised on the caller's side.

In addition to these fundamental calling functionalities, the library includes an implementation of asynchronous iterators. Clients can send, and servers can handle, asynchronous iterators, serving as a foundation for bidirectional communication using `AsyncIterators`.

High-level methods to perform individual calls over `MessagePort` instances:
* [callPort](#callport-method) - implements asynchronious port calls with timeouts; (see the `listenPort` method)
* [listenPort](#listenport-method) - listens the specified port and delegates calls to  the registered handler; the methods are handled asynchronously and results delivered to the caller (see the `callPort` method)

Example: call a remote peer and recieve the result
```js
const channel = new MessageChannel();
channel.port1.start();
channel.port2.start();
const close = listenPort(channel.port1, async (params) => {
  return {
    message: "Hello World!",
    params
  }
});
try {
  const result = await callPort(channel.port2, { foo: "bar" });
  console.log(result);
  // Output:
  // { message: 'Hello World!', params: { foo: 'bar' } }
} finally {
  close();
}
```

Hig-level methods to call `AsyncGenerator` functions with `AsyncIterator` as parameters:
* [callBidi](#callbidi-method) - This method calls the peer handler over a port with a stream of input values and it returns the stream of resulting values
* [listenBidi](#listenport-method) - Listens for entering requests and delegates calls to the given method to handle input streams; the resulting stream of values is retuned by the handler method is returned to the caller over the same port.

Example: 
```js
const channel = new MessageChannel();
channel.port1.start();
channel.port2.start();

// The "server-side" handler transforming input stream 
// to a sequence of output values:
async function* handler(input, params) {
  for await (let value of input) {
    yield value.toUpperCase();
  }
}
// Registration of the server-side handler:
const close = listenBidi(channel.port1, handler);
try {
  // Input values.
  // It could be an AsyncIterator instead.
  const input = ["Hello", "World"]; 
  const params = { foo: 'Bar' };
  for await (let value of callBidi(
    channel.port2, 
    input, 
    params
  )) {
    console.log('* ', value);
  }
} finally {
  close();
}
// Output:
// *  HELLO
// *  WORLD
```

`AsyncIterator`s over `MessagePort`s:
* [recieve](#recieve-method) - transforms a sequence of calls to the specified port to an AsyncIterator; Internally uses the `recieveIterator` method. On the other side the the `send` method used to send an iterator. 
* [send](#send-method) - sends the specified async iterator over the specified port; Internally uses the `sendIterator` method. On the other side the `recieve` method handles calls. 


Utility methods, without dependencies on `MessagePort`s:
* [errors](src/#errors) - contains serializeError/deserializeError methods transforming exceptions in JSON objects and restoring them back as Error instances 
* [recieveIterator](#recieveiterator-method) - an adaptor method allowing to transform a sequence of calls to the `onMessage` method to an async iterator 
* [sendIterator](#senditerator-method) - an utility method transforming an iterator to a sequence of calls to the registered handler.

Other files:
* `index.j` the main entry point for the library; re-exports all defined methods

## API

### `callBidi` method

This method calls the peer handler over a port with a stream of input values and it returns the stream of resulting values.

Parameters:

* `port` - a `MessagePort` instance used to transmit the messages
* `input` - The input to send to the peer; an `AsyncIterator` instance.
 * `args` - The arguments object containing call parameters.
 * `args.options` - The call options like:
   - `bidiTimeout` - The timeout of the stream to recieve; by default it is 2147483647 (max integer).
   - `timeout` - The timeout of invidual calls (1000 ms by default); used to send each individual stream value.
 * `args.params` - Additional call parameters used by peers to handle calls; it could contain some parameters like method name; the peer side will recieve in parameters the generated `channelName` value.

Returns an `AsyncIterator` that yields the resulting values retured by the peer.

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

### `listenBidi` method

Listens for entering requests and delegates calls to the given method to handle input streams; the resulting stream of values is retuned by the handler method is returned to the caller over the same port.

Parameters:
 * `port` - a `MessagePort` sending/recieving messages
 * `action` - an `AsyncGenerator` instance recieving an `AsyncIterator` with input values and yielding a stream of restuls returned to the caller
 * `accept` - the function allowing to accept/reject the initial call based on recieved parameters.

 It returns a method allowing to remove the registered call handler.

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

