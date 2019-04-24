# Simple Garage Door Opener

[![npm version](https://badge.fury.io/js/homebridge-simple-garage-door-opener.svg)](https://badge.fury.io/js/homebridge-simple-garage-door-opener)

A Homebridge Plugin for controlling your garage door via your iOS device.

Being frustrated about the lack of homekit-enabled garage door openers which don't need any modifications on the garage door itself, I created my own solution.
Oh and it's pretty cheap too.

The setup is pretty straight forward. All you need is a raspberry pi or other device running [homebridge](https://github.com/nfarina/homebridge). A modified remote control (details are down below). That's it.


### Why *another* homebridge plugin?
There are already some plugins out there doing something similar. The problem with this simple setup of mine is the lack of a reporting functionality/backchannel 'cause all I am doing is triggering the opening of the door. Therefore homekit doesn't know anything about the current state (opening/open/closing).
Most plugins need some kind of sensory input to tell homekit exactly that. As I can't tell homekit what state the door actually is in, I just pretend to know and give homekit some information to work with.


### Getting Started

#### Prepare your existing garage door remote
As I am living in a house with multiple parties, I can't modify the garage door electronics directly. So I looked for an other way. I just used the existing remote control which is a `Sommer Handsender 4020` which is pretty common in Germany and modified it.

PLEASE NOTE THAT I DON'T HAVE MUCH EXPERIENCE IN BUILDING ELECTRICAL CIRCUITS AND THEREFORE WON'T PROVIDE HELP IN BUILDING THE CIRCUIT.

#### Install via npm (>= v6.x.x)
`npm install homebridge-simple-garage-door-opener -g`


#### Install Manually
Clone the latest release [here](https://github.com/danielreiser/Homebridge-Simple-Garage-Door-Opener). Install via `npm -i -g`.


#### Edit the ./homebridge/config.json
You don't need that much to get started. Just tell Simple Garage Door Opener which GPIO you want to use and you're good to go. (More options available, see next section)

```
"accessories": [{
    "accessory": "SimpleGarageDoorOpener",
    "name": "SimpleGarageDoorOpener",
    "doorSwitchPin": 12,
    "simulateTimeOpening": 15,
    "simulateTimeClosing": 15,
    "autoClosingMode": "none",
    "autoClosingDelay": 30
}]
```

#### *config.js* Options table

| Option              | Description                                                                                                                   |  Type  | Notes about value(s)                                                          | Required | Default value                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------- |
| accessory           | Accessory identifier, unique value.                                                                                           | string | Only `"SimpleGarageDoorOpener"` must be used                                  |   YES    | None                                                                            |
| verbose             | Shows more logs in Homebridge console                                                                                         |  bool  | -                                                                             |    NO    | `false`                                                                         |
| name                | The name that your homekit application will show                                                                              | string | -                                                                             |    NO    | `"SimpleGarageDoorOpener"`                                                      |
| doorSwitchPin       | GPIO PIN used to trigger your garage door                                                                                     | number | -                                                                             |    NO    | `12`                                                                            |
| simulateTimeOpening | Amount of time your garage door takes to be fully open (in seconds)                                                           | number | -                                                                             |    NO    | `15`                                                                            |
| simulateTimeClosing | Amount of time your garage door takes to be fully closed (in seconds)                                                         | number | -                                                                             |    NO    | `15`                                                                            |
| autoClosingMode     | Different modes to handle garage door autoclosing                                                                             | string | Modes are `"none"` `"auto"` `"force"` (see below for information about modes) |    NO    | `"none"`                                                                        |
| autoClosingDelay    | Time for your garage to initiate autoclosing in seconds (`"auto"` and `"force"` modes only)                                   | number | -                                                                             |    NO    | `30`                                                                            |
| initialGPIOMode     | GPIO mode used at start when opening connection between plugin and GPIO pin                                                   | string | GPIO modes can be `"INPUT"` `"OUTPUT"`                                        |    NO    | `"INPUT"`                                                                       |
| initialGPIOValue    | GPIO value used at start when opening connection between plugin and GPIO pin (only for `"INPUT"` mode)                        | string | GPIO values can be `"LOW"` `"HIGH"`                                           |    NO    | `"LOW"`                                                                         |
| GPIOActionDelay     | Delay to wait between 2 GPIO actions (in seconds)                                                                             | number | -                                                                             |    NO    | `0.5`                                                                           |
| GPIOOpenActions     | Actions to perform in order to trigger the garage door. A delay of `GPIOActionDelay` seconds is effective between each action | array  | Array of Objects (see object definition below)                                |    NO    | `[{ "type": "mode", "value": "OUTPUT" }, { "type": "mode", "value": "INPUT" }]` |


**autoClosingMode** option:
| Value | Description                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none  | Autoclosing disabled, nothing will be done                                                                                                              |
| auto  | Your garage door is self-autoclosing. The `autoClosingDelay` will be then used to give HomeKit an estimation about when your garage door is autoclosing |
| force | Your garage door is **NOT** self-autoclosing, Homebridge will force closing after `autoClosingDelay` seconds                                            |

**GPIOOpenActions** option, object definition:
| Value | Description                                                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type  | Type of action that rpio will perform, possible values are `"mode"` or `"write"`                                                                                                                            |
| value | Value that will be send to rpio when calling the function defined by `type` above. If `type` is `"mode"`, values can be `"INPUT"` or `"OUTPUT"`. If `type` is `"WRITE"`, values can be `"HIGH"` or `"LOW"`. |

#### Misc
Feel free to give me feedback, create PRs or submit issues, enhancements and bugs.