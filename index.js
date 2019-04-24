'use strict';

const rpio = require('rpio');
const inspector = require('schema-inspector');

var Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-simple-garage-door-opener', 'SimpleGarageDoorOpener', SimpleGarageDoorOpener);
};

function getRPIOProperty(schema, post) {
  if (!post) {
    return;
  }

  if (rpio[post] !== undefined) {
    return rpio[post];
  }

  return;
}

class SimpleGarageDoorOpener {
  constructor(log, config) {

    // get config values
    this.log = log;
    this.verbose = config['verbose'] || false;
    this.name = config['name'] || 'SimpleGarageDoorOpener';
    this.currentTimeOuts = [];

    this.simulateTimeOpening = config['simulateTimeOpening'] || 15;
    this.autoClosingDelay = config['autoClosingDelay'] || 30;
    this.simulateTimeClosing = config['simulateTimeClosing'] || 15;
    this.autoClosingMode = config['autoClosingMode'] || 'none';

    this.doorSwitchPin = config['doorSwitchPin'] || 12;
    this.initialGPIOMode = getRPIOProperty(null, config['initialGPIOMode']);
    this.initialGPIOValue = getRPIOProperty(null, config['initialGPIOValue']);

    this.GPIOActionDelay = config['GPIOActionDelay'] || 0.5;
    this.GPIOOpenActions = config['GPIOOpenActions'] || [
      { "write": rpio.HIGH },
      { "write": rpio.LOW }
    ];

    this.sanitizeConfig();

    if (this.verbose) {
      this.logConfig();
    }

    //initial setup
    this.lastOpened;
    this.lastClosed;

    this.service = new Service.GarageDoorOpener(this.name, this.name);
    this.setupGarageDoorOpenerService(this.service);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Simple Garage Door')
      .setCharacteristic(Characteristic.Model, 'A Remote Control')
      .setCharacteristic(Characteristic.SerialNumber, '0711');
  }

  sanitizeConfig() {
    inspector.sanitize({
      type: 'number',
      eq: [rpio.INPUT, rpio.OUTPUT],
      def: rpio.OUTPUT
    }, this.initialGPIOMode);

    inspector.sanitize({
      type: 'number',
      eq: [rpio.HIGH, rpio.LOW],
      def: rpio.HIGH
    }, this.initialGPIOValue);

    inspector.sanitize({
      type: 'string',
      eq: ['force', 'self', 'none'],
      def: 'none'
    }, this.autoClosingMode);

    inspector.sanitize({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', eq: ['write', 'mode'], exec: getRPIOProperty },
          value: { type: 'string', eq: ['INPUT', 'OUTPUT', 'HIGH', 'LOW'], exec: getRPIOProperty }
        }
      }
    }, this.GPIOOpenActions);

    const result = inspector.validate({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'function', eq: [rpio.write, rpio.mode] },
          value: { type: 'number', eq: [rpio.INPUT, rpio.OUTPUT, rpio.HIGH, rpio.LOW] }
        }
      }
    }, this.GPIOOpenActions);

    if (!result.valid) {
      console.error(result.format());
      throw 'Error';
    }
  }

  logConfig() {
    this.log('Verbose logging: ' + this.verbose);

    this.log('Opening door time duration (sec): ' + this.simulateTimeOpening);
    this.log('Closing door time duration (sec): ' + this.simulateTimeClosing);

    this.log('Delay before autoclosing (sec): ' + this.autoClosingDelay);
    this.log('Autoclosing mode: ' + this.autoClosingMode);

    if (this.initialGPIOMode == rpio.INPUT) {
      this.log('Initial GPIO Mode: "rpio.INPUT"');
    }
    else if (this.initialGPIOMode == rpio.OUTPUT) {
      this.log('Initial GPIO Mode: "rpio.OUTPUT"');
    }

    if (this.initialGPIOValue == rpio.HIGH) {
      this.log('Initial GPIO Value: "rpio.HIGH"');
    }
    else if (this.initialGPIOValue == rpio.LOW) {
      this.log('Initial GPIO Value: "rpio.LOW"');
    }

    this.log('Open door GPIO actions: ', this.GPIOOpenActions);
    this.log('Delay between GPIO Actions (sec): ' + this.GPIOActionDelay);
  }

  getServices() {
    return [this.informationService, this.service];
  }

  setupGarageDoorOpenerService(service) {
    rpio.open(this.doorSwitchPin, this.initialGPIOMode, this.initialGPIOValue);

    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);

    service.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', (callback) => {
        let targetDoorState = service.getCharacteristic(Characteristic.TargetDoorState).value;

        if (this.autoClosingMode !== 'none' && targetDoorState === Characteristic.TargetDoorState.OPEN && ((new Date() - this.lastOpened) >= (this.autoClosingDelay * 1000))) {
          this.log('Setting TargetDoorState -> CLOSED');
          callback(null, Characteristic.TargetDoorState.CLOSED);
        } else {
          callback(null, targetDoorState);
        }
      })
      .on('set', (value, callback) => {
        if (value === Characteristic.TargetDoorState.OPEN) {

          switch (service.getCharacteristic(Characteristic.CurrentDoorState).value) {
            case Characteristic.CurrentDoorState.CLOSED:
            case Characteristic.CurrentDoorState.OPEN:
              this.openGarageDoor(callback);
              break;

            case Characteristic.CurrentDoorState.CLOSING:
              this.openGarageDoor(callback, true);
              break;

            default:
              callback();
          }

        }
        else if (value === Characteristic.TargetDoorState.CLOSED) {
          switch (service.getCharacteristic(Characteristic.CurrentDoorState).value) {
            case Characteristic.CurrentDoorState.OPEN:
            case Characteristic.CurrentDoorState.CLOSED:
              this.closeGarageDoor(callback);
              break;

            case Characteristic.CurrentDoorState.OPENING:
              this.closeGarageDoor(callback, true);
              break;

            default:
              callback();
          }
        }
      });
  }

  executeGPIOActions() {
    for (const action of this.GPIOOpenActions) {
      action.type(this.doorSwitchPin, action.value);
      rpio.sleep(this.GPIOActionDelay);
    }
  }

  resetActionsQueue() {
    for (let i = 0; i < this.currentTimeOuts.length; ++i) {
      clearTimeout(this.currentTimeOuts[i]);
    }
  }

  openGarageDoor(callback, force) {
    this.lastOpened = new Date();

    this.resetActionsQueue();
    this.executeGPIOActions();

    let openingTimeRemaining = this.simulateTimeOpening;
    if (force) {
      this.log('Garage was closing, we force reopening');
      this.executeGPIOActions();

      if (this.lastClosed) {
        const secsFromLastClose = (this.lastOpened.getTime() - this.lastClosed.getTime()) / 1000;

        // If garage did not finish closing
        // Estimate time remaining until opened
        if (secsFromLastClose < this.simulateTimeClosing) {
          openingTimeRemaining = (secsFromLastClose / this.simulateTimeClosing) * this.simulateTimeOpening;
          this.log('Calculated ' + openingTimeRemaining + ' secs remaing (default: %d secs) before opened', this.simulateTimeOpening);

          this.lastOpened.setSeconds(this.lastOpened.getSeconds() - openingTimeRemaining);
        }
      }
    }

    this.log('Opening Garage door...');
    this.simulateGarageDoorOpening(openingTimeRemaining);

    if (callback) {
      callback();
    }
  }

  closeGarageDoor(callback, force) {
    this.lastClosed = new Date();

    this.resetActionsQueue();
    this.executeGPIOActions();

    let closingTimeRemaining = this.simulateTimeClosing;
    if (force) {
      this.log('Garage was opening, we force reclosing');
      this.executeGPIOActions();

      if (this.lastOpened) {
        const secsFromLastOpen = (this.lastClosed.getTime() - this.lastOpened.getTime()) / 1000;

        // If garage did not finish opening
        // Estimate time remaining until closed
        if (secsFromLastOpen < this.simulateTimeOpening) {
          closingTimeRemaining = (secsFromLastOpen / this.simulateTimeOpening) * this.simulateTimeClosing;
          this.log('Calculated ' + closingTimeRemaining + ' secs remaing (default: %d secs) before closed', this.simulateTimeClosing);

          this.lastClosed.setSeconds(this.lastClosed.getSeconds() - closingTimeRemaining);
        }
      }
    }

    this.log('Closing Garage door...');
    this.simulateGarageDoorClosing(closingTimeRemaining);

    if (callback) {
      callback();
    }
  }


  simulateGarageDoorOpening(openingTimeRemaining) {
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);

    this.currentTimeOuts.push(setTimeout(() => {
      this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
      if (this.verbose) {
        this.log('Garage is fully opened');

        if (this.autoClosingMode !== 'none') {
          this.log('Garage should close in ' + this.autoClosingDelay + ' secs');
        }
      }

      if (this.autoClosingMode !== 'none') {
        this.currentTimeOuts.push(setTimeout(() => {
          if (this.autoClosingMode === 'force') {
            this.log('Forcing auto closing...');
            this.closeGarageDoor();
            return;
          }

          this.simulateGarageDoorClosing(this.simulateTimeClosing);

        }, this.autoClosingDelay * 1000));
      }

    }, openingTimeRemaining * 1000));
  }

  simulateGarageDoorClosing(closingTimeRemaining) {
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);

    this.currentTimeOuts.push(setTimeout(() => {
      this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
      if (this.verbose) {
        this.log('Garage is closed');
      }

    }, closingTimeRemaining * 1000));
  }
}
