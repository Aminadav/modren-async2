'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var assert = require('nanoassert');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var assert__default = /*#__PURE__*/_interopDefaultLegacy(assert);

/**
 * Wraps a function call that may be synchronous in a function that
 * is guaranted to be async. This is a stricter version of calling a
 * function and wrapping its result using `Promise.resolve()` as the new function also
 * handles the case where the original function throws an exception.
 *
 * @param {Function} fct The function to wrap.
 * @returns {Function} The wrapped function.
 * @example
 * import { asyncWrap } from 'modern-async'
 *
 * const myFunction = () => {
 *   // any kind of function that may or may not return a promise
 * }
 *
 * const asyncFct = asyncWrap(myFunction)
 *
 * const promise = asyncFct()
 * console.log(promise instanceof Promise) // prints true
 */
function asyncWrap (fct) {
  assert__default['default'](typeof fct === 'function', 'fct must be a function');
  return async function () {
    return fct(...arguments)
  }
}

/**
 * Immediately calls an asynchronous function and redirects to an error handler if it throws an exception.
 * The error handler is optional, the default one just outputs the error in the console.
 *
 * This function is trivial but useful in the context of node.js when you would like to use await in the root
 * scope. It is also used in most examples provided for this library.
 *
 * @param {Function} fct An asynchronous function to call.
 * @param {Function} errorHandler (Optional) A facultative error handler. This function will receive a single argument:
 * the thrown exception. The default behavior is to output the exception in the console.
 *
 * @example
 * import { asyncRoot } from 'modern-async'
 *
 * // or
 *
 * const { asyncRoot } = require('modern-async')
 *
 * asyncRoot(async () => {
 *   // any code using await
 * }, (e) => {
 *   console.error("An error occured", e)
 *   process.exit(-1)
 * })
 */
async function asyncRoot (fct, errorHandler = null) {
  errorHandler = errorHandler || ((e) => {
    console.error(e);
  });
  const asyncFct = asyncWrap(fct);
  try {
    await asyncFct();
  } catch (e) {
    errorHandler(e);
  }
}

/**
 * An error type which is used when a promise is cancelled.
 */
class CancelledError extends Error {
  /**
   * Constructs a new instance.
   *
   * @param {string} message The error message
   */
  constructor (message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * A basic class to create a promise with its resolve and reject function in the same object.
 *
 * Instances of this class are never returned by any function of this library but it is used
 * internally and can be useful to code other asynchronous helpers.
 *
 * @example
 * import { Deferred, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const deferred = new Deferred()
 *
 *   sleep(10).then(() => {
 *     deferred.resolve('test')
 *   })
 *
 *   console.log(await deferred.promise) // will wait 10ms before printing 'test'
 * })
 */
class Deferred {
  /**
   * Constructs a deferred object.
   */
  constructor () {
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * (Read-only) The promise.
   *
   * @member {Promise}
   *
   * @returns {Promise} ignored
   */
  get promise () {
    return this._promise
  }

  /**
   * (Read-only) The resolve function.
   *
   * @member {Function}
   *
   * @returns {Function} The resolve function
   */
  get resolve () {
    return this._resolve
  }

  /**
   * (Read-only) The reject function
   *
   * @member {Function}
   *
   * @returns {Function} The reject function
   */
  get reject () {
    return this._reject
  }
}

/**
 * Waits a given amount of time. This function returns both a promise and cancel function in
 * order to cancel the wait time if necessary. If cancelled, the promise will be rejected
 * with a `CancelledError`.
 *
 * This function uses `setTimeout()` internally and has the same behavior, notably that it could resolve
 * after the asked time (depending on other tasks running in the event loop) or a few milliseconds before.
 *
 * @param {number} amount An amount of time in milliseconds
 * @returns {Array} A tuple of two objects:
 *   * `promise`: The promise
 *   * `cancel`: The cancel function. It will return a boolean that will be `true` if the promise was effectively cancelled,
 *     `false` otherwise.
 * @example
 * import { sleepCancellable, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const [promise, cancel] = sleepCancellable(100) // schedule to resolve the promise after 100ms
 *
 *   cancel()
 *
 *   try {
 *     await promise
 *   } catch (e) {
 *     console.log(e.name) // prints CancelledError
 *   }
 * })
 */
function sleepCancellable (amount) {
  assert__default['default'](typeof amount === 'number', 'amount must be a number');
  let id;
  const deferred = new Deferred();
  setTimeout(deferred.resolve, amount);
  let terminated = false;
  return [deferred.promise.finally(() => {
    terminated = true;
  }), () => {
    if (terminated) {
      return false
    } else {
      terminated = true;
      deferred.reject(new CancelledError());
      clearTimeout(id);
      return true
    }
  }]
}

/**
 * A function returning a promise that will be resolved in a later tick of the event loop.
 *
 * This function returns both a promise and cancel function in order to cancel the wait time if
 * necessary. If cancelled, the promise will be rejected with a CancelledError.
 *
 * This function simply uses `setTimeout()` internally as it's the most portable solution.
 *
 * @returns {Array} A tuple of two objects:
 *   * The promise
 *   * The cancel function. It will return a boolean that will be true if the promise was effectively cancelled,
 *     false otherwise.
 * @example
 * import { delayCancellable, asyncRoot, CancelledError } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const [promise, cancel] = delayCancellable()
 *   cancel()
 *   try {
 *     await promise
 *   } catch (e) {
 *     console.log(e instanceof CancelledError) // prints true
 *   }
 * })
 */
function delayCancellable () {
  return sleepCancellable(0)
}

/**
 * A function returning a promise that will be resolved in a later tick of the event loop.
 *
 * This function simply uses `setTimeout()` internally as it's the most portable solution.
 *
 * @returns {Promise} A promise that will be resolved on a later tick of the event loop.
 * @example
 * import { delay, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   console.log('this executes in a tick of the event loop')
 *   await delay()
 *   console.log('this executes in another tick of the event loop')
 * })
 */
async function delay () {
  return delayCancellable()[0]
}

/**
 * A class used to spread time or cpu intensive operations on multiple tasks in the event loop in order
 * to avoid blocking other tasks that may need to be executed.
 *
 * It is configured with a trigger time, which represents the maximum amount of time your tasks should
 * monopolize the event loop. Choosing an appropriate trigger time is both important and hard. If too low
 * it will impact the performances of your long running algorithm. If too high it will impact the other
 * tasks that need to run in the event loop.
 *
 * When using Delayer your code should contain frequent calls to `await delayer.checkDelay()`, usually
 * at the end of every loop. `checkDelay()` will check the amount of time that ellasped since the last time
 * your called it. If the amount of time is below the trigger time it returns immediately. If not it will
 * call the `delay()` function that will retrigger the operation in a later task of the event loop.
 *
 * @example
 * import { Delayer, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const delayer = new Delayer(10) // a delayer with 10ms trigger time
 *
 *   // some cpu intensive operation that will run for a long time
 *   for (let i = 0; i < 100000000; i += 1) {
 *     // some code
 *     await delayer.checkDelay()
 *   }
 * })
 */
class Delayer {
  /**
   * Constructs a new `Delayer` by specifying its trigger time.
   *
   * @param {number} triggerTime The trigger time.
   */
  constructor (triggerTime) {
    this.triggerTime = triggerTime;
    this.reset();
  }

  /**
   * The trigger time of this `Delayer` in milliseconds. The trigger time represent the
   * maximum amount of time before a call to `checkDelay()` decide to schedule a new task in the event loop.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get triggerTime () {
    return this._triggerTime
  }

  /**
   * @ignore
   *
   * @param {number} triggerTime ignore
   */
  set triggerTime (triggerTime) {
    assert__default['default'](typeof triggerTime === 'number', 'trigger time must be a number');
    this._triggerTime = triggerTime;
  }

  /**
   * Resets the internal timer to the current time.
   */
  reset () {
    this._last = new Date().getTime();
  }

  /**
   * Checks if a delay must be applied according to the internal timer. If that's the case this method
   * will call `delay()` and return `true`. If not it will do nothing and return `false`.
   *
   * @returns {boolean} `true` if a new task was scheduled in the event loop, `false` otherwise.
   */
  async checkDelay () {
    const current = new Date().getTime();
    if (current - this._last >= this.triggerTime) {
      await delay();
      this.reset();
      return true
    } else {
      return false
    }
  }
}

/**
 * A class representing a queue.
 *
 * Tasks added to the queue are processed in parallel (up to the concurrency limit).
 * If all slots of the queue are occupied, the task is queued until one becomes available.
 * When a slot is freed, the pending task with higher priority is executed. If multiple pending tasks have the same
 * priority the first that was scheduled is executed.
 *
 * Once a task is completed, its corresponding promise is terminated accordingly.
 *
 * @example
 * import { Queue, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const queue = new Queue(3) // create a queue with concurrency 3
 *
 *   const array = Array.from(Array(100).keys()) // an array of 100 numbers from 0 to 99
 *
 *   const promises = []
 *   for (const i of array) {
 *     promises.push(queue.exec(async () => {
 *       console.log(`Starting task ${i}`)
 *       await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *       console.log(`Ending task ${i}`)
 *       return i;
 *     }))
 *   }
 *   const results = await Promise.all(promises)
 *   // all the scheduled tasks will perform with a maximum concurrency of 3 and log when they start and stop
 *
 *   console.log(results) // will display an array with the result of the execution of each separate task
 * })
 */
class Queue {
  /**
   * Constructs a queue with the given concurrency
   *
   * @param {number} concurrency The concurrency of the queue, must be an integer greater than 0 or
   * `Number.POSITIVE_INFINITY`.
   */
  constructor (concurrency) {
    assert__default['default'](Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY,
      'concurrency must be an integer or positive infinity');
    assert__default['default'](concurrency > 0, 'concurrency must be greater than 0');
    if (concurrency !== Number.POSITIVE_INFINITY) {
      this._queue = new _InternalQueuePriority(concurrency);
    } else {
      this._queue = new _InternalInfinityQueue();
    }
  }

  /**
   * (Read-only) The concurrency of the queue.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get concurrency () {
    return this._queue.concurrency
  }

  /**
   * (Read-only) The current number of tasks that are processing.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get running () {
    return this._queue.running
  }

  /**
   * (Read-only) The number of pending tasks.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get pending () {
    return this._queue.pending
  }

  /**
   * Puts a task at the end of the queue. When the task is executed and completes the returned promise will be terminated
   * accordingly.
   *
   * @param {Function} fct An asynchronous functions representing the task. It will be executed when the queue has
   * available slots and its result will be propagated to the promise returned by exec().
   * @param {number} priority (Optional) The priority of the task. The higher the priority is, the sooner the task will be
   * executed regarding the priority of other pending tasks. Defaults to 0.
   * @returns {Promise} A promise that will be resolved or rejected once the task has completed. Its state will be the same
   * than the promise returned by the call to `fct`.
   */
  async exec (fct, priority = 0) {
    return this._queue.exec(fct, priority)
  }

  /**
   * Puts a task at the end of the queue. When the task is executed and completes the returned promise will be terminated
   * accordingly.
   *
   * This function returns both a promise and a cancel function. The cancel function allows to cancel the pending task,
   * but only if it wasn't started yet. Calling the cancel function on a task that it already running has no effect.
   * When a task is cancelled its corresponding promise will be rejected with a `CancelledError`.
   *
   * @param {Function} fct An asynchronous functions representing the task. It will be executed when the queue has
   * available slots and its result will be propagated to the promise returned by exec().
   * @param {number} priority (Optional) The priority of the task. The higher the priority is, the sooner the task will be
   * executed regarding the priority of other pending tasks. Defaults to 0.
   * @returns {Array} A tuple with two parameters:
   *   * `promise`: A promise that will be resolved or rejected once the task has completed. Its state will be the same
   *     than the promise returned by the call to `fct`.
   *   * `cancel`: A cancel function. When called it will cancel the task if it is still pending. It has no effect is the
   *     task has already started or already terminated. When a task is cancelled its corresponding promise will be
   *     rejected with a `CancelledError`. If will return `true` if the task was effectively pending and was cancelled,
   *     `false` in any other case.
   */
  execCancellable (fct, priority = 0) {
    return this._queue.execCancellable(fct, priority)
  }

  /**
   * Cancels all pending tasks. Their corresponding promises will be rejected with a `CancelledError`. This method will
   * not alter tasks that are already running.
   *
   * @returns {number} The number of pending tasks that were effectively cancelled.
   */
  cancelAllPending () {
    return this._queue.cancelAllPending()
  }

  /**
   * @ignore
   * @param {any} errClass ignore
   */
  set _cancelledErrorClass (errClass) {
    this._queue._errorClass = errClass;
  }
}

/**
 * @ignore
 */
class _InternalQueuePriority {
  /**
   * @ignore
   *
   * @param {number} concurrency ignore
   */
  constructor (concurrency) {
    this._concurrency = concurrency;
    this._iqueue = [];
    this._running = 0;
    this._errorClass = CancelledError;
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get concurrency () {
    return this._concurrency
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get running () {
    return this._running
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get pending () {
    return this._iqueue.length - this.running
  }

  /**
   * @ignore
   *
   * @param {*} fct ignored
   * @param {*} priority ignored
   * @returns {*} ignored
   */
  async exec (fct, priority) {
    return this.execCancellable(fct, priority)[0]
  }

  /**
   * @ignore
   * @param {*} fct ignore
   * @param {*} priority ignore
   * @returns {*} ignore
   */
  execCancellable (fct, priority) {
    assert__default['default'](typeof fct === 'function', 'fct must be a function');
    assert__default['default'](typeof priority === 'number', 'priority must be a number');
    const deferred = new Deferred();
    let i = this._iqueue.length;
    while (i >= 1) {
      const t = this._iqueue[i - 1];
      if (t.priority >= priority) {
        break
      }
      i -= 1;
    }
    const task = {
      asyncFct: asyncWrap(fct),
      deferred,
      running: false,
      priority
    };
    this._iqueue.splice(i, 0, task);
    this._checkQueue();
    return [deferred.promise, () => {
      if (task.running) {
        return false
      } else {
        const filtered = this._iqueue.filter((v) => v !== task);
        if (filtered.length < this._iqueue.length) {
          this._iqueue = filtered;
          deferred.reject(new this._errorClass());
          return true
        } else {
          return false
        }
      }
    }]
  }

  /**
   * @ignore
   */
  _checkQueue () {
    while (true) {
      assert__default['default'](this.running >= 0, 'invalid state');
      assert__default['default'](this.running <= this.concurrency, 'invalid state');
      if (this.running === this.concurrency) {
        return
      }
      const task = this._iqueue.find((v) => !v.running);
      if (task === undefined) {
        return
      }
      task.running = true;
      this._running += 1;
      task.asyncFct().finally(() => {
        this._running -= 1;
        this._iqueue = this._iqueue.filter((v) => v !== task);
        this._checkQueue();
      }).then(task.deferred.resolve, task.deferred.reject);
    }
  }

  /**
   * @ignore
   * @returns {*} ignore
   */
  cancelAllPending () {
    const toCancel = this._iqueue.filter((task) => !task.running);
    this._iqueue = this._iqueue.filter((task) => task.running);
    toCancel.forEach((task) => {
      task.deferred.reject(new this._errorClass());
    });
    return toCancel.length
  }
}

/**
 * @ignore
 */
class _InternalInfinityQueue {
  /**
   * @ignore
   */
  constructor () {
    this._running = 0;
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get concurrency () {
    return Number.POSITIVE_INFINITY
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get running () {
    return this._running
  }

  /**
   * @ignore
   * @returns {number} ignore
   */
  get pending () {
    return 0
  }

  /**
   * @ignore
   *
   * @param {Function} fct ignore
   * @returns {Promise} ignore
   */
  async exec (fct) {
    return this.execCancellable(fct)[0]
  }

  /**
   * @ignore
   *
   * @param {*} fct ignore
   * @returns {*} ignore
   */
  execCancellable (fct) {
    this._running += 1;
    const asyncFct = asyncWrap(fct);
    const p = asyncFct();
    return [p.finally(() => {
      this._running -= 1;
    }), () => false]
  }

  /**
   * @ignore
   * @returns {*} ignore
   */
  cancelAllPending () {
    return 0
  }
}

/**
 * Returns the index of the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run in parallel, up to a concurrency limit. This implies that
 * the element found by this function may not be the first element of the iterable able to pass the
 * truth test. It will be the first one in time for which one of the parallel calls to `iteratee` was able to
 * return a positive result. If you need a sequential alternative use `findIndexSeries()`.
 *
 * Whenever a result is found, all the remaining tasks will be cancelled as long
 * as they didn't started already. In case of exception in one of the iteratee calls the promise
 * returned by this function will be rejected with the exception and the remaining pending
 * tasks will also be cancelled. In the very specific case where a result is found and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times iteratee can be called concurrently.
 * @returns {Promise} A promise that will be resolved with the index of the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `-1`.
 * @example
 * import { findIndexLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3, 4, 5]
 *   const result = await findIndexLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 3
 *     // concurrent calls
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   }, 3)
 *   console.log(result) // prints 0, 2 or 4 randomly
 *   // 4 is a potential result in this case even with a concurrency of 3 due to how
 *   // randomness works, and all asynchronous operations are inherently random. The only way to ensure an
 *   // order is to use a concurreny of 1 or to use findSeries() which does the same thing.
 * })
 */
async function findIndexLimit (iterable, iteratee, concurrency) {
  assert__default['default'](typeof iteratee === 'function', 'iteratee must be a function');
  const queue = new Queue(concurrency);
  queue._cancelledErrorClass = CustomCancelledError;
  const promises = [];
  let current = promises;
  let finalized = false;
  const finalize = () => {
    if (!finalized) {
      current.forEach((p) => {
        p.catch(() => {
          // ignore the exception
        });
      });
      queue.cancelAllPending();
    }
    finalized = true;
  };
  let i = 0;
  for (const el of iterable) {
    const index = i;
    promises.push((async () => {
      try {
        const gres = await queue.exec(async () => {
          try {
            const res = await iteratee(el, index, iterable);
            if (res) {
              finalize();
            }
            return res
          } catch (e) {
            finalize();
            throw e
          }
        });
        return [index, 'resolved', gres]
      } catch (e) {
        return [index, 'rejected', e]
      }
    })());
    i += 1;
  }

  try {
    while (current.length > 0) {
      const [index, state, result] = await Promise.race(current);
      if (state === 'resolved') {
        if (result) {
          return index
        }
      } else { // error
        if (!(result instanceof CustomCancelledError)) {
          throw result
        }
      }
      promises[index] = null;
      current = promises.filter((p) => p !== null);
    }
    return -1
  } finally {
    finalize();
  }
}

/**
 * @ignore
 */
class CustomCancelledError extends CancelledError {}

/**
 * Returns `true` if all elements of an iterable pass a truth test and `false` otherwise.
 *
 * The iteratee will be run in parallel, up to a concurrency limit. If any truth test returns `false`
 * the promise is immediately resolved.
 *
 * Whenever a test returns `false`, all the remaining tasks will be cancelled as long
 * as they didn't started already. In case of exception in one of the iteratee calls the promise
 * returned by this function will be rejected with the exception and the remaining pending
 * tasks will also be cancelled. In the very specific case where a test returns `false` and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times iteratee can be called concurrently.
 * @returns {Promise} A promise that will be resolved to `true` if all values pass the truth test and `false`
 * if a least one of them doesn't pass it. That promise will be rejected if one of the truth test throws
 * an exception.
 * @example
 * import { everyLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await everyLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 2
 *     // concurrent calls
 *     await sleep(10) // waits 10ms
 *     return v > 0
 *   }, 2)
 *   console.log(result) // prints true
 *   // total processing time should be ~ 20ms
 * })
 */
async function everyLimit (iterable, iteratee, concurrency) {
  const index = await findIndexLimit(iterable, async (value, index, iterable) => {
    return !(await iteratee(value, index, iterable))
  }, concurrency);
  const result = index === -1;
  return result
}

/**
 * Returns `true` if all elements of an iterable pass a truth test and `false` otherwise.
 *
 * The iteratee will be run in parallel. If any truth test returns `false` the promise is immediately resolved.
 *
 * In case of exception in one of the iteratee calls the promise returned by this function will be rejected
 * with the exception. In the very specific case where a test returns `false` and an already started task throws
 * an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved to `true` if all values pass the truth test and `false`
 * if a least one of them doesn't pass it. That promise will be rejected if one of the truth test throws
 * an exception.
 * @example
 * import { every, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await every(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(10) // waits 10ms
 *     return v > 0
 *   })
 *   console.log(result) // prints true
 *   // total processing time should be ~ 10ms
 * })
 */
async function every (iterable, iteratee) {
  return everyLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Returns `true` if all elements of an iterable pass a truth test and `false` otherwise.
 *
 * The iteratee will be run sequentially. If any truth test returns `false` the promise is
 * immediately resolved.
 *
 * In case of exception in one of the iteratee calls the promise returned by this function will be
 * rejected with the exception and the remaining pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved to `true` if all values pass the truth test and `false`
 * if a least one of them doesn't pass it. That promise will be rejected if one of the truth test throws
 * an exception.
 * @example
 * import { everySeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await everySeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v > 0
 *   })
 *   console.log(result) // prints true
 *   // total processing time should be ~ 30ms
 * })
 */
async function everySeries (iterable, iteratee) {
  return everyLimit(iterable, iteratee, 1)
}

/**
 * Produces a new collection of values by mapping each value in `iterable` through the `iteratee` function.
 *
 * Multiple calls to `iteratee` will be performed in parallel, up to the concurrency limit.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times `iteratee` can be called concurrently.
 * @returns {Promise} A promise that will be resolved with an array containing all the mapped value,
 * or will be rejected if any of the calls to `iteratee` throws an exception.
 * @example
 * import { mapLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await mapLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 2
 *     // concurrent calls
 *     await sleep(10) // waits 10ms
 *     return v * 2
 *   }, 2)
 *   console.log(result) // prints [2, 4, 6]
 *   // total processing time should be ~ 20ms
 * })
 */
async function mapLimit (iterable, iteratee, concurrency) {
  assert__default['default'](typeof iteratee === 'function', 'iteratee must be a function');
  const queue = new Queue(concurrency);
  queue._cancelledErrorClass = CustomCancelledError$1;
  const promises = [];
  let current = promises;
  let finalized = false;
  const finalize = () => {
    if (!finalized) {
      current.forEach((p) => {
        p.catch(() => {
          // ignore the exception
        });
      });
      queue.cancelAllPending();
    }
    finalized = true;
  };
  let i = 0;
  for (const el of iterable) {
    const index = i;
    promises.push((async () => {
      try {
        const gres = await queue.exec(async () => {
          try {
            const res = await iteratee(el, index, iterable);
            return res
          } catch (e) {
            finalize();
            throw e
          }
        });
        return [index, 'resolved', gres]
      } catch (e) {
        return [index, 'rejected', e]
      }
    })());
    i += 1;
  }

  const results = [];

  try {
    while (current.length > 0) {
      const [index, state, result] = await Promise.race(current);
      if (state === 'resolved') {
        results[index] = result;
      } else { // error
        if (!(result instanceof CustomCancelledError$1)) {
          throw result
        }
      }
      promises[index] = null;
      current = promises.filter((p) => p !== null);
    }
    return results
  } finally {
    finalize();
  }
}

/**
 * @ignore
 */
class CustomCancelledError$1 extends CancelledError {}

/**
 * Returns a new array of all the values in iterable which pass an asynchronous truth test.
 *
 * The calls to `iteratee` will perform in parallel, up to the concurrency limit, but the results array will be
 * in the same order than the original.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of `iterable`. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times iteratee can be called concurrently.
 * @returns {Promise} A promise that will be resolved with an array containing all the values that passed
 * the truth test. This promise will be rejected if any of the `iteratee` calls throws an exception.
 * @example
 * import { filterLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await filterLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 2
 *     // concurrent calls
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 1
 *   }, 2)
 *   console.log(result) // prints [1, 3]
 *   // total processing time should be ~ 20ms
 * })
 */
async function filterLimit (iterable, iteratee, concurrency) {
  assert__default['default'](typeof iteratee === 'function', 'iteratee must be a function');
  return (await mapLimit(iterable, async (v, i, t) => {
    return [v, await iteratee(v, i, t)]
  }, concurrency)).filter(([v, t]) => t).map(([v, t]) => v)
}

/**
 * Returns a new array of all the values in iterable which pass an asynchronous truth test.
 *
 * The calls to `iteratee` will perform in parallel, but the results array will be in the same order
 * than the original.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of `iterable`. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with an array containing all the values that passed
 * the truth test. This promise will be rejected if any of the `iteratee` calls throws an exception.
 * @example
 * import { filter, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await filter(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // prints [1, 3]
 *   // total processing time should be ~ 10ms
 * })
 */
async function filter (iterable, iteratee) {
  return filterLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Returns a new array of all the values in iterable which pass an asynchronous truth test.
 *
 * The calls to `iteratee` will perform sequentially and the results array will be in the same order
 * than the original.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with an array containing all the values that passed
 * the truth test. This promise will be rejected if any of the `iteratee` calls throws an exception.
 * @example
 * import { filterSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await filterSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // prints [1, 3]
 *   // total processing time should be ~ 30ms
 * })
 */
async function filterSeries (iterable, iteratee) {
  return filterLimit(iterable, iteratee, 1)
}

/**
 * Returns the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run in parallel, up to a concurrency limit. This implies that
 * the element found by this function may not be the first element of the iterable able to pass the
 * truth test. It will be the first one for which one of the parallel calls to `iteratee` was able to
 * return a positive result. If you need a sequential alternative use `findSeries()`.
 *
 * Whenever a result is found, all the remaining tasks will be cancelled as long
 * as they didn't started already. In case of exception in one of the `iteratee` calls the promise
 * returned by this function will be rejected with the exception and the remaining pending
 * tasks will also be cancelled. In the very specific case where a result is found and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times iteratee can be called concurrently.
 * @returns {Promise} A promise that will be resolved with the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `undefined`.
 * @example
 * import { findLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3, 4, 5]
 *   const result = await findLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 3
 *     // concurrent calls
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   }, 3)
 *   console.log(result) // prints 1, 3 or 5 randomly
 *   // 5 is a potential result in this case even with a concurrency of 3 due to how
 *   // randomness works, and all asynchronous operations are inherently random. The only way to ensure an
 *   // order is to use a concurreny of 1 or to use findSeries() which does the same thing.
 * })
 */
async function findLimit (iterable, iteratee, concurrency) {
  const arr = Array.from(iterable);
  const index = await findIndexLimit(iterable, iteratee, concurrency);
  return index === -1 ? undefined : arr[index]
}

/**
 * Returns the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run in parallel. This implies that the element found by this function may not
 * be the first element of the iterable able to pass the truth test. It will be the first one in time
 * for which one of the parallel calls to `iteratee` was able to return a positive result. If you need
 * a sequential alternative use `findSeries()`.
 *
 * In case of exception in one of the `iteratee` calls the promise returned by this function will be
 * rejected with the exception. In the very specific case where a result is found and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `undefined`.
 * @example
 * import { find, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await find(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // prints 1 or 3 randomly
 * })
 */
async function find (iterable, iteratee) {
  return findLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Returns the index of the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run in parallel. This implies that the element found by this function may not
 * be the first element of the iterable able to pass the truth test. It will be the first one in time
 * for which one of the parallel calls to `iteratee` was able to return a positive result. If you need
 * a sequential alternative use `findIndexSeries()`.
 *
 * In case of exception in one of the `iteratee` calls the promise returned by this function will be
 * rejected with the exception. In the very specific case where a result is found and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with the index of the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `-1`.
 * @example
 * import { findIndex, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await findIndex(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // prints 0 or 2 randomly
 * })
 */
async function findIndex (iterable, iteratee) {
  return findIndexLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Returns the index of the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run sequentially. As opposed to `findIndex()` and `findIndexLimit()` this ensures
 * that if multiple values may pass the truth test it will be the first one of the iterable that will be
 * returned.
 *
 * In case of exception in one of the `iteratee` calls the promise returned by this function will be
 * rejected with the exception and the remaining pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with the index of the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `-1`.
 * @example
 * import { findIndexSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await findIndexSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // always prints 0
 * })
 */
async function findIndexSeries (iterable, iteratee) {
  return findIndexLimit(iterable, iteratee, 1)
}

/**
 * Returns the first element of an iterable that passes an asynchronous truth test.
 *
 * The calls to `iteratee` will run sequentially. As opposed to `find()` and `findLimit()` this ensures
 * that if multiple values may pass the truth test it will be the first one of the iterable that will be
 * returned.
 *
 * In case of exception in one of the `iteratee` calls the promise returned by this function will be
 * rejected with the exception.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with the first found value or rejected if one of the
 * `iteratee` calls throws an exception before finding a value. If no value is found it will return `undefined`.
 * @example
 * import { findSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await findSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     return v % 2 === 1
 *   })
 *   console.log(result) // always prints 1
 * })
 */
async function findSeries (iterable, iteratee) {
  return findLimit(iterable, iteratee, 1)
}

/**
 * Calls a function on each element of iterable.
 *
 * Multiple calls to `iteratee` will be performed in parallel, up to the concurrency limit.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times iteratee can be called concurrently.
 * @returns {Promise} A promise that will be resolved when all the calls to `iteratee` have been done.
 * This promise will be rejected if any call to `iteratee` throws an exception.
 * @example
 * import { forEachLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   await forEachLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 2
 *     // concurrent calls
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     console.log(v)
 *   }, 2)
 *   // prints 1, 2 and 3 in a random order (it will always print 1 or 2 before printing 3 due to
 *   // the concurrency limit and the internal scheduling order)
 * })
 */
async function forEachLimit (iterable, iteratee, concurrency) {
  await mapLimit(iterable, async (v, i, t) => {
    await iteratee(v, i, t);
  }, concurrency);
}

/**
 * Calls a function on each element of iterable.
 *
 * Multiple calls to `iteratee` will be performed in parallel.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved when all the calls to `iteratee` have been done.
 * This promise will be rejected if any call to `iteratee` throws an exception.
 * @example
 * import { forEach, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   await forEach(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     console.log(v)
 *   })
 *   // prints 1, 2 and 3 in a random order
 * })
 */
async function forEach (iterable, iteratee) {
  return forEachLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Calls a function on each element of iterable.
 *
 * Multiple calls to `iteratee` will be performed sequentially.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved when all the calls to `iteratee` have been done.
 * This promise will be rejected if any call to `iteratee` throws an exception.
 * @example
 * import { forEachSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   await forEachSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(Math.random() * 10) // waits a random amount of time between 0ms and 10ms
 *     console.log(v)
 *   })
 *   // prints 1, 2 and 3 in that exact order
 * })
 */
async function forEachSeries (iterable, iteratee) {
  return forEachLimit(iterable, iteratee, 1)
}

/**
 * Produces a new collection of values by mapping each value in `iterable` through the `iteratee` function.
 *
 * Multiple calls to `iteratee` will be performed in parallel.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with an array containing all the mapped value,
 * or will be rejected if any of the calls to `iteratee` throws an exception.
 * @example
 * import { map, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await map(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(10) // waits 10ms
 *     return v * 2
 *   })
 *   console.log(result) // prints [2, 4, 6]
 *   // total processing time should be ~ 10ms
 * })
 */
async function map (iterable, iteratee) {
  return mapLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Produces a new collection of values by mapping each value in `iterable` through the `iteratee` function.
 *
 * Multiple calls to `iteratee` will be performed sequentially.
 *
 * If any of the calls to iteratee throws an exception the returned promise will be rejected and the remaining
 * pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved with an array containing all the mapped value,
 * or will be rejected if any of the calls to `iteratee` throws an exception.
 * @example
 * import { mapSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await mapSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v * 2
 *   }, 2)
 *   console.log(result) // prints [2, 4, 6]
 *   // total processing time should be ~ 30ms
 * })
 */
async function mapSeries (iterable, iteratee) {
  return mapLimit(iterable, iteratee, 1)
}

/**
 * Performs a reduce operation as defined in the `Array.reduce()` method but using an asynchronous
 * function as reducer. The reducer will be called sequentially.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} reducer The reducer function. It will be called with four arguments:
 *   * `accumulator`: The last calculated value (or the first value of the iterable if no initial value is provided)
 *   * `value`: The current value
 *   * `index`: The current index in the iterable. Will start from 0 if no initial value is provided, 1 otherwise.
 *   * `iterable`: The iterable on which the reduce operation is performed.
 * @param {*} initial The initial value that will be used as accumulator in the first call to
 *   `reducer`. If omitted the first element of `iterable` will be used as accumulator and `reducer`
 *   will only be called from from the second element of the list (as defined in the `Array.reduce()`
 *   function).
 * @returns {Promise} A promise that will be resolved with the result of the reduce operation,
 *   or rejected if any of the calls to `reducer` throws an exception.
 * @example
 * import { reduce, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await reduce(array, async (v, p) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v + p
 *   })
 *   console.log(result) // prints 6
 *   // total processing time should be ~ 20ms
 * })
 */
async function reduce (iterable, reducer, initial = undefined) {
  assert__default['default'](typeof reducer === 'function', 'reducer must be a function');
  if (initial !== undefined) {
    let current = initial;
    let i = 0;
    for (const el of iterable) {
      current = await reducer(current, el, i, iterable);
      i += 1;
    }
    return current
  } else {
    let i = 0;
    let current;
    for (const el of iterable) {
      if (i === 0) {
        current = el;
      } else {
        current = await reducer(current, el, i, iterable);
      }
      i += 1;
    }
    if (i === 0) {
      throw new TypeError('Reduce of empty array with no initial value')
    }
    return current
  }
}

/**
 * Performs a reduce operation as defined in the `Array.reduceRight()` method but using an asynchronous
 * function as reducer. The reducer will be called sequentially.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} reducer The reducer function. It will be called with four arguments:
 *   * `accumulator`: The last calculated value (or the first value of the iterable if no initial value is provided)
 *   * `value`: The current value
 *   * `index`: The current index in the iterable. Will start from the last index if no initial value is provided,
 *     the last index minus 1 otherwise.
 *   * `iterable`: The iterable on which the reduce operation is performed.
 * @param {*} initial The initial value that will be used as accumulator in the first call to
 *   reducer. If omitted the first element of `iterable` will be used as accumulator and `reducer`
 *   will only be called from from the second element of the list (as defined in the `Array.reduce()`
 *   function).
 * @returns {Promise} A promise that will be resolved with the result of the reduce operation,
 *   or rejected if any of the calls to `reducer` throws an exception.
 * @example
 * import { reduceRight, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *   const result = await reduceRight(array, async (v, p) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v + p
 *   })
 *   console.log(result) // prints 6
 *   // total processing time should be ~ 20ms
 * })
 */
async function reduceRight (iterable, reducer, initial = undefined) {
  const arr = Array.from(iterable);
  arr.reverse();
  return reduce(arr, (accumulator, value, index, iterable) => {
    return reducer(accumulator, value, arr.length - 1 - index, iterable)
  }, initial)
}

/**
 * A class implementing a scheduler.
 *
 * It fills the same purpose than setInterval() but its behavior is more adapted to asynchronous
 * tasks. Notably it can limit the concurrency of asynchronous tasks running in parallel.
 *
 * @example
 * import { Scheduler, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   let i = 0
 *   const scheduler = new Scheduler(async () => {
 *     const taskNbr = i
 *     i += 1
 *     console.log(`Starting task ${taskNbr}`)
 *     await sleep(10) // waits 10ms
 *     console.log(`Ending task ${taskNbr}`)
 *   }, 100) // a scheduler that triggers every 100ms
 *   // the default configuration uses a maximum concurrency of 1 and doesn't allow pending
 *   // tasks, which mean that if a task takes more time to complete than the delay it will be skipped
 *
 *   scheduler.start() // starts the scheduler
 *
 *   await sleep(1000) // waits 1s, during that time the task should trigger ~ 9 times
 *
 *   scheduler.stop() // stops the scheduler
 *   console.log('Scheduler stopped')
 *   // no "Starting task" console message may appear from here but you could still see a
 *   // "Stopping task" as there could have a task that started before we stopped the
 *   // scheduler
 * })
 */
class Scheduler {
  /**
   * Constructs a Scheduler.
   *
   * @param {Function} fct The asynchronous function to call when the scheduler is triggered.
   * @param {number} delay The delay between two triggering of the scheduler, in ms.
   * @param {object} options (Optional) An object that can contain additional options:
   *
   *   * `startImmediate`: If true a new task will be triggered as soon as the start() method is called.
   *     Defaults to ´false`.
   *   * `concurrency`: The maximum number of concurrent tasks. See the `concurrency` attribute. Defaults to 1.
   *   * `maxPending`: The maximum number of pending tasks. See the `maxPending` attribute. Defaults to 0.
   */
  constructor (fct, delay, options = null) {
    options = options || {};
    this._asyncFct = asyncWrap(fct);
    this._delay = delay;
    assert__default['default'](typeof this._delay === 'number', 'delay must be a number');
    assert__default['default'](this._delay >= 0, 'delay must be greater or equal than 0');
    this._startImmediate = options.startImmediate || false;
    assert__default['default'](typeof this._startImmediate === 'boolean',
      'startImmediate must be a boolean');
    this._maxPending = options.maxPending || 0;
    assert__default['default'](Number.isInteger(this._maxPending) || this._maxPending === Number.POSITIVE_INFINITY,
      'maxPending must be an integer or positive infinity');
    assert__default['default'](this._maxPending >= 0, 'maxPending must be greater or equal than 0');
    this._queue = new Queue(options.concurrency || 1);
    this._started = false;
    this._initialTime = null;
    this._nbrTriggering = null;
    this._cancelSleep = null;
  }

  /**
   * (Read-only) The delay between two triggering of the scheduler, in milliseconds.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get delay () {
    return this._delay
  }

  /**
   * (Read-only) Whether or not a triggering of the task should occur immediately when calling `start()` or not.
   *
   * Defaults to false.
   *
   * @member {boolean}
   *
   * @returns {boolean} ignore
   */
  get startImmediate () {
    return this._startImmediate
  }

  /**
   * (Read-only) The maximum number of asynchronous tasks that can run in parallel.
   *
   * This parameter only matters in the event where some tasks may take more time to execute
   * than the delay. If the concurrency allows it the new task will be run concurrently. If not
   * it may be scheduled to be executed depending on the configuration of the `maxPending` parameter.
   *
   * Defaults to 1.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get concurrency () {
    return this._queue.concurrency
  }

  /**
   * (Read-only) The maximum number of tasks that can be pending.
   *
   * In the event where one of the tasks triggered by the scheduler takes more time to execute than
   * the delay the next task may or may not be run concurrently depending on the configuration of
   * the `concurrency` parameter. If the maximum concurrency was already reached the new task can
   * be scheduled to be executed as soon as the previous task finished.
   *
   * This parameter indicates the maximum amount of tasks that can be pending at any time. If a
   * task should be scheduled and the maximum amount of pending tasks is already reached
   * that new task will be skipped.
   *
   * This behavior helps to prevent cases that would lead to a infinite amount of tasks to be
   * pending. This could happen in extreme cases where the tasks would take systematically more
   * time to execute than the delay.
   *
   * Defaults to 0.
   *
   * @member {number}
   *
   * @returns {number} ignore
   */
  get maxPending () {
    return this._maxPending
  }

  /**
   * (Read-only) Whether or not the scheduler is actually started.
   *
   * @member {boolean}
   *
   * @returns {boolean} ignore
   */
  get started () {
    return this._started
  }

  /**
   * Starts the scheduler.
   *
   * Calling this method can trigger a task immediately depending on the configuration
   * of the `startImmediate` parameter.
   *
   * If this method is called while the scheduler is already started it will have no effect.
   */
  start () {
    if (this.started) {
      return
    }
    assert__default['default'](this._queue.pending === 0);
    this._started = true;

    this._initialTime = new Date().getTime();
    this._nbrTriggering = 0;

    if (this.startImmediate) {
      this._triggerTask();
    }

    this._scheduleSleep();
  }

  /**
   * Stops the scheduler.
   *
   * If, for any reason, there were pending tasks in the scheduler they will be cancelled. On the other
   * hand if they are still one or more tasks that are running they will continue to run until they
   * terminate.
   *
   * This method is safe to call in a task if necessary.
   *
   * If this method is called while the scheduler is already stopped it will have no effect.
   */
  stop () {
    if (!this.started) {
      return
    }
    assert__default['default'](!!this._cancelSleep);
    this._cancelSleep();
    this._cancelSleep = null;
    this._queue.cancelAllPending();
    assert__default['default'](this._queue.pending === 0);
    this._started = false;
    this._initialTime = null;
    this._nbrTriggering = null;
  }

  /**
   * @ignore
   */
  _scheduleSleep () {
    this._nbrTriggering += 1;
    const nextTime = this._initialTime + (this.delay * this._nbrTriggering);
    const currentTime = new Date().getTime();
    const [promise, cancel] = sleepCancellable(nextTime - currentTime);
    this._cancelSleep = cancel;
    promise.then(() => {
      this._triggerTask();
      this._scheduleSleep();
    }, () => {
      // ignore cancelled sleep
    });
  }

  /**
   * @ignore
   */
  _triggerTask () {
    const reachedMaxConcurrency = this._queue.running === this._queue.concurrency;
    const forecastPending = reachedMaxConcurrency ? this._queue.pending + 1 : 0;
    if (forecastPending <= this.maxPending) {
      this._queue.exec(this._asyncFct).catch(exceptionHandler);
    }
  }
}

const exceptionHandler = (e) => {
  if (e instanceof CancelledError) ; else {
    throw e
  }
};

/**
 * Waits a given amount of time.
 *
 * This function uses `setTimeout()` internally and has the same behavior, notably that it could resolve
 * after the asked time (depending on other tasks running in the event loop) or a few milliseconds before.
 *
 * @param {number} amount An amount of time in milliseconds
 * @returns {Promise} A promise that will be resolved after the given amount of time has passed.
 * @example
 * import { sleep, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   await sleep(100) // will wait 100ms
 * })
 * @example
 * // another example that doesn't block on the sleep call
 * // it's functionally identical to using setTimout but with a promise syntax
 * import { sleep } from 'modern-async'
 *
 * sleep(10).then(() => {
 *   console.log('hello')
 * })
 * // will print 'hello' after 10ms
 */
async function sleep (amount) {
  return sleepCancellable(amount)[0]
}

/**
 * Waits a given amount of time.
 *
 * This function returns both a promise and cancel function in order to cancel the
 * wait time if necessary. If cancelled, the promise will be rejected with a `CancelledError`.
 *
 * This function is similar to `sleep()` except it ensures that the amount of time measured
 * using the `Date` object is always greater than or equal the asked amount of time.
 *
 * This function can imply additional delay that can be bad for performances. As such it is
 * recommended to only use it in unit tests or very specific cases. Most applications should
 * be adapted to work with the usual `setTimout()` inconsistencies even if it can trigger some
 * milliseconds before the asked delay.
 *
 * @param {number} amount An amount of time in milliseconds
 * @returns {Array} A tuple of two objects:
 *   * `promise`: The promise
 *   * `cancel`: The cancel function. It will return a boolean that will be `true` if the promise was effectively cancelled,
 *     `false` otherwise.
 * @example
 * import { sleepPreciseCancellable, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const [promise, cancel] = sleepPreciseCancellable(100) // schedule to resolve the promise after 100ms
 *
 *   cancel()
 *
 *   try {
 *     await promise
 *   } catch (e) {
 *     console.log(e.name) // prints CancelledError
 *   }
 * })
 */
function sleepPreciseCancellable (amount) {
  return _innerWaitPreciseCancellable(amount, (ellasped, amount) => {
    return ellasped >= amount
  })
}

/**
 * @ignore
 *
 * @param {*} amount ignored
 * @param {*} checkPassed ignored
 * @returns {*} ignored
 */
function _innerWaitPreciseCancellable (amount, checkPassed) {
  assert__default['default'](typeof amount === 'number', 'amount must be a number');
  const start = new Date().getTime();
  const [p, cancel] = sleepCancellable(amount);
  let lastCancel = cancel;
  const deferred = new Deferred();
  const reject = (e) => {
    deferred.reject(e);
  };
  const resolve = () => {
    const now = new Date().getTime();
    const ellasped = now - start;
    if (checkPassed(ellasped, amount)) {
      deferred.resolve();
    } else {
      const [np, ncancel] = sleepCancellable(amount - ellasped);
      lastCancel = ncancel;
      np.then(resolve, reject);
    }
  };
  p.then(resolve, reject);
  return [deferred.promise, () => {
    return lastCancel()
  }]
}

/**
 * Waits a given amount of time.
 *
 * This function is similar to `sleep()` except it ensures that the amount of time measured
 * using the `Date` object is always greater than or equal the asked amount of time.
 *
 * This function can imply additional delay that can be bad for performances. As such it is
 * recommended to only use it in unit tests or very specific cases. Most applications should
 * be adapted to work with the usual `setTimout()` inconsistencies even if it can trigger some
 * milliseconds before the asked delay.
 *
 * @param {number} amount An amount of time in milliseconds
 * @returns {Promise} A promise that will be resolved after the given amount of time has passed.
 * @example
 * import { sleepPrecise, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   await sleepPrecise(100) // will wait 100ms
 * })
 */
async function sleepPrecise (amount) {
  return sleepPreciseCancellable(amount)[0]
}

/**
 * Returns `true` if at least one element of an iterable pass a truth test and `false` otherwise.
 *
 * The calls to `iteratee` will run in parallel, up to a concurrency limit. If any truth test returns `true`
 * the promise is immediately resolved.
 *
 * Whenever a test returns `true`, all the remaining tasks will be cancelled as long
 * as they didn't started already. In case of exception in one of the `iteratee` calls the promise
 * returned by this function will be rejected with the exception and the remaining pending
 * tasks will also be cancelled. In the very specific case where a test returns `true` and an
 * already started task throws an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @param {number} concurrency The number of times `iteratee` can be called concurrently.
 * @returns {Promise} A promise that will be resolved to `true` if at least one value pass the truth test and `false`
 * if none of them do. That promise will be rejected if one of the truth test throws an exception.
 * @example
 * import { someLimit, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await someLimit(array, async (v) => {
 *     // these calls will be performed in parallel with a maximum of 2
 *     // concurrent calls
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 0
 *   }, 2)
 *   console.log(result) // prints true
 *   // total processing time should be ~ 10ms
 * })
 */
async function someLimit (iterable, iteratee, concurrency) {
  const index = await findIndexLimit(iterable, iteratee, concurrency);
  const result = index !== -1;
  return result
}

/**
 * Returns `true` if at least one element of an iterable pass a truth test and `false` otherwise.
 *
 * The calls to `iteratee` will run in parallel. If any truth test returns `true` the promise is immediately resolved.
 *
 * In case of exception in one of the `iteratee` calls the promise returned by this function will be rejected
 * with the exception. In the very specific case where a test returns `true` and an already started task throws
 * an exception that exception will be plainly ignored.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved to `true` if at least one value pass the truth test and `false`
 * if none of them do. That promise will be rejected if one of the truth test throws an exception.
 * @example
 * import { some, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await some(array, async (v) => {
 *     // these calls will be performed in parallel
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 0
 *   })
 *   console.log(result) // prints true
 *   // total processing time should be ~ 10ms
 * })
 */
async function some (iterable, iteratee) {
  return someLimit(iterable, iteratee, Number.POSITIVE_INFINITY)
}

/**
 * Returns `true` if all elements of an iterable pass a truth test and `false` otherwise.
 *
 * The calls to `iteratee` will run sequentially. If any truth test returns `true` the promise is
 * immediately resolved.
 *
 * In case of exception in one of the iteratee calls the promise returned by this function will be
 * rejected with the exception and the remaining pending tasks will be cancelled.
 *
 * @param {Iterable} iterable An iterable object.
 * @param {Function} iteratee A function that will be called with each member of the iterable. It will receive
 * three arguments:
 *   * `value`: The current value to process
 *   * `index`: The index in the iterable. Will start from 0.
 *   * `iterable`: The iterable on which the operation is being performed.
 * @returns {Promise} A promise that will be resolved to `true` if at least one value pass the truth test and `false`
 * if none of them do. That promise will be rejected if one of the truth test throws an exception.
 * @example
 * import { someSeries, asyncRoot, sleep } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   const array = [1, 2, 3]
 *
 *   const result = await someSeries(array, async (v) => {
 *     // these calls will be performed sequentially
 *     await sleep(10) // waits 10ms
 *     return v % 2 === 0
 *   })
 *   console.log(result) // prints true
 *   // total processing time should be ~ 20ms
 * })
 */
async function someSeries (iterable, iteratee) {
  return someLimit(iterable, iteratee, 1)
}

/**
 * An error type which is used when an asynchronous operation takes too much time to perform.
 */
class TimeoutError extends Error {
  /**
   * Constructs a new instance.
   *
   * @param {string} message The error message
   */
  constructor (message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Wraps a call to an asynchronous function to add a timer on it. If the delay is exceeded
 * the returned promise will be rejected with a `TimeoutError`.
 *
 * This function uses `setTimeout()` internally and has the same behavior, notably that it could reject
 * after the asked time (depending on other tasks running in the event loop) or a few milliseconds before.
 *
 * @param {Function} fct An asynchronous function that will be called immediately without arguments.
 * @param {number} amount An amount of time in milliseconds
 * @returns {Promise} A promise that will be resolved or rejected according to the result of the call
 * to `fct`. If `amount` milliseconds pass before the call to `fct` returns or rejects, this promise will
 * be rejected with a `TimeoutError`.
 * @example
 * import { timeout, sleep, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   // the following statement will perform successfully because
 *   // the function will return before the delay
 *   await timeout(async () => {
 *     await sleep(10)
 *   }, 100)
 *
 *   try {
 *     // the following statement will throw after 10ms
 *     await timeout(async () => {
 *       await sleep(100)
 *     }, 10)
 *   } catch (e) {
 *     console.log(e.name) // prints TimeoutError
 *   }
 * })
 */
async function timeout (fct, amount) {
  const asyncFct = asyncWrap(fct);

  const [timoutPromise, cancelTimeout] = sleepCancellable(amount);

  const basePromise = asyncFct();

  const deferred = new Deferred();

  basePromise.then(deferred.resolve, deferred.reject);

  timoutPromise.then(() => {
    deferred.reject(new TimeoutError());
  }, () => {
    // ignore CancelledError
  });

  return deferred.promise.finally(cancelTimeout)
}

/**
 * Wraps a call to an asynchronous function to add a timer on it. If the delay is exceeded
 * the returned promise will be rejected with a `TimeoutError`.
 *
 * This function is similar to `timeout()` except it ensures that the amount of time measured
 * using the `Date` object is always greater than or equal the asked amount of time.
 *
 * This function can imply additional delay that can be bad for performances. As such it is
 * recommended to only use it in unit tests or very specific cases. Most applications should
 * be adapted to work with the usual `setTimout()` inconsistencies even if it can trigger some
 * milliseconds before the asked delay.
 *
 * @param {Function} fct An asynchronous function that will be called immediately without arguments.
 * @param {number} amount An amount of time in milliseconds
 * @returns {Promise} A promise that will be resolved or rejected according to the result of the call
 * to `fct`. If `amount` milliseconds pass before the call to `fct` returns or rejects, this promise will
 * be rejected with a `TimeoutError`.
 * @example
 * import { timeoutPrecise, sleep, asyncRoot } from 'modern-async'
 *
 * asyncRoot(async () => {
 *   // the following statement will perform successfully because
 *   // the function will return before the delay
 *   await timeoutPrecise(async () => {
 *     await sleep(10)
 *   }, 100)
 *
 *   try {
 *     // the following statement will throw after 10ms
 *     await timeoutPrecise(async () => {
 *       await sleep(100)
 *     }, 10)
 *   } catch (e) {
 *     console.log(e.name) // prints TimeoutError
 *   }
 * })
 */
async function timeoutPrecise (fct, amount) {
  const asyncFct = asyncWrap(fct);

  const [timoutPromise, cancelTimeout] = sleepPreciseCancellable(amount);

  const basePromise = asyncFct();

  const deferred = new Deferred();

  basePromise.then(deferred.resolve, deferred.reject);

  timoutPromise.then(() => {
    deferred.reject(new TimeoutError());
  }, () => {
    // ignore CancelledError
  });

  return deferred.promise.finally(cancelTimeout)
}

exports.CancelledError = CancelledError;
exports.Deferred = Deferred;
exports.Delayer = Delayer;
exports.Queue = Queue;
exports.Scheduler = Scheduler;
exports.TimeoutError = TimeoutError;
exports.asyncRoot = asyncRoot;
exports.asyncWrap = asyncWrap;
exports.delay = delay;
exports.delayCancellable = delayCancellable;
exports.every = every;
exports.everyLimit = everyLimit;
exports.everySeries = everySeries;
exports.filter = filter;
exports.filterLimit = filterLimit;
exports.filterSeries = filterSeries;
exports.find = find;
exports.findIndex = findIndex;
exports.findIndexLimit = findIndexLimit;
exports.findIndexSeries = findIndexSeries;
exports.findLimit = findLimit;
exports.findSeries = findSeries;
exports.forEach = forEach;
exports.forEachLimit = forEachLimit;
exports.forEachSeries = forEachSeries;
exports.map = map;
exports.mapLimit = mapLimit;
exports.mapSeries = mapSeries;
exports.reduce = reduce;
exports.reduceRight = reduceRight;
exports.sleep = sleep;
exports.sleepCancellable = sleepCancellable;
exports.sleepPrecise = sleepPrecise;
exports.sleepPreciseCancellable = sleepPreciseCancellable;
exports.some = some;
exports.someLimit = someLimit;
exports.someSeries = someSeries;
exports.timeout = timeout;
exports.timeoutPrecise = timeoutPrecise;
