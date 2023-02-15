[![CI](https://github.com/locize/xliff/actions/workflows/ci.yml/badge.svg)](https://github.com/locize/xliff/actions/workflows/ci.yml) [![travis](https://img.shields.io/travis/locize/xliff.svg)](https://travis-ci.org/locize/xliff) [![npm](https://img.shields.io/npm/v/xliff.svg)](https://npmjs.org/package/xliff)

# XLIFF2
This is a fork of the [locize/xliff](https://github.com/locize/xliff) project to fix the XLIFF2 behaviour which is incorrect or incomplete in several aspects.

The details will be explained in a few examples below. The goal is that this will be merged to the locize/xliff project.
But as this was a rather time-critical issue in our project, we decided to publish it like this for now.

This was forked from locize/xliff 6.1.0, from which also the examples and quotes are taken.

The examples and quotes from the official XLIFF 2.0 documentation are taken from: http://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html

## What's wrong with locize XLIFF2 conversion?

Let's first look at the upper part of [locize's original example](#xliff-20)

```js
  <file id="namespace1">
    <unit id="key1">
      <segment>
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
    </unit>
    <unit id="key2">
      <segment>
        <source>An application to manipulate and process XLIFF documents</source>
        <target>Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten</target>
      </segment>
    </unit>
```

will compile to 

```json
{"resources": {
    "namespace1": {
      "key1": {
        "source": "Hello",
        "target": "Hallo"
      },
      "key2": {
        "source": "An application to manipulate and process XLIFF documents",
        "target": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten"
      }
```

### Multiple segments
This is not wrong by itself. (The exact transformation logic is not prescribed). But let's look at a slightly extended example to see one of the limitations.
XLIFF defines units as 
> "Static container for a dynamic structure of elements holding the extracted translatable source text, aligned with the Translated text." 

and consequently explicitly allows (besides others) "One or more `<segment>` attributes". This is very useful, to keep 
related text fragments, e.g. of one template, view or UI element together.
But if we put this in locize/xliff2js:
```js
  <file id="namespace1">
    <unit id="key1">
      <segment>
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
      <segment>
        <source>Good Bye</source>
        <target>Auf Wiederluaga</target>
      </segment>
    </unit>
...
```
it will compile to
```json
{"resources": {
    "namespace1": {
      "key1": {
        "source": "Good Bye",
        "target": "Auf Wiederluaga"
      }
      ...
```
So, only the last segment of the unit will make it into the resulting JS. The expected result would probably look as 
follows (note the array!):
```json
{"resources": {
    "namespace1": {
      "key1": [
        {
          "source": "Hallo",
          "target": "Hello"
        },
        {
          "source": "Good Bye",
          "target": "Auf Wiederluaga"
        }
      ],
      ...
```

### Segments with IDs
Another thing that is problematic, is when segments are used with IDs. With the applied logic, where only one segment in 
a unit can be used and the ID of the unit will be used for the result in the JSON, this is of course not a problem. 
But to structure (and be able to use) the fragments, they might often be identified with IDs. 

Using IDs is explicitly allowed, however optional in XLIFF 2.

In the current implementation of locize
```xml
  <file id="namespace1">
    <unit id="key1">
      <segment id="hello">
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
      <segment id="goodBye">
        <source>Good Bye</source>
        <target>Auf Wiederluaga</target>
      </segment>
    </unit>
...
```
will still compile to 

```json
{"resources": {
    "namespace1": {
      "key1": {
        "source": "Good Bye",
        "target": "Auf Wiederluaga"
      }
      ...
```

So the segment id is completely ignored. Now, while it can be debated, which would be the correct approach (also considering 
that theoretically the segments could also be "mixed" (with and without ID)), this result is definitely not very helpful. 

As we use the IDs to select the elements for the higher levels (file, group, unit) which is very handy in many cases, 
this would also be beneficial (and probably expected) here:

```json
{"resources": {
    "namespace1": {
      "key1": {
        "hallo": {
          "source": "Hallo",
          "target": "Hello"
        },
        "goodBye": {
          "source": "Good Bye",
          "target": "Auf Wiederluaga"
        }
      },
      ...
```

### Groups
Now, let's look at the lower part of the xliff example (IDs adjusted):

```xml
    ...
    <group id="my-group">
      <unit id="my-unit">
        <segment>
          <source>Group</source>
          <target>Gruppe</target>
        </segment>
      </unit>
    </group>
```
will compile to:

```json
    ...
      "my-group": {
        "groupUnits":{
          "my-unit": {
            "source": "Group",
            "target": "Gruppe"
          }
        }
      }
```
As can be easily seen, xliff creates an additional "artificial" level (object) "groupUnits" in the JSON result.

Again, this is not wrong by itself but brings unnecessary complexity and can bear problems in the usage:

XLIFF 2.0 definition for group is
> Provides a way to organize units into a structured hierarchy.
> Note that this is especially useful for mirroring a source format's hierarchical structure.

and allows a group to contain units or again groups. 
With this possibility, complex and versatile structures can be created (where necessary), 
to match virtually every imaginable use case. 

But if every level will be mapped to two levels in the JSON result this will cause unnecessary implementation effort and 
additional logic in some cases (and it becomes difficult, to "mirror a source format's hierarchical structure"). 
On the other hand, the added level brings few to no apparent benefits:

There are typically multiple units within a group. Groups and units must have an ID in XLIFF 2 
(https://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html#group). 
Additionally, "the value (id) MUST be unique among all `<unit>` id attribute values within the enclosing <file> element."

So, there is no ambiguity and units can always be accessed with `my-group.my-unit`. In contrast, the xliff result would
have to use `my-group.groupUnits.my-unit`.

## Solution approach

### (Multiple) segments with IDs shall be supported 

"Unnamed" segments (without ID) are not used in our project, so they are neglected for now. This also enables to create some 
downwards compatibility for now.

However, if all segments within a unit have an ID, they shall definitely all be compiled and named by ID in the result.

If there is one segment without ID in the unit, the current logic can be kept for now.

Eventually, the following might make sense: 
 * One or more segments with IDs in a unit => Create objects with IDs as name `my-unit.my-segment.target`
 * Multiple segments without IDs in a unit => Create an array with unnamed objects `my-unit[2].target`
 * One segment without ID in a unit => TBD, either also an array `my-unit[2].target` (which would be consequent)
   or directly accessible via unit ID (as current implementation) `my-unit.target`
 * Mixed: segments with and without ID in a unit => TBD. Proposal: Separate so IDs can directly be used, rest in an array
   `my-unit.my-segment.target` AND `my-unit[2].target`. 

### Groups shall not generate an additional object level

As files and units, groups shall just be compiled into a regular object with their ID as name. No additional steps necessary.
However, it must be regarded, that groups can be nested. Therefore, the implementation should be recursive.

## State of this implementation

### Works:
* Multiple segments with IDs are supported and become single "named" objects in the result, which can be accessed by their name (ID)
* Groups are compiled "directly", without adding an additional object/level
* "Fallback": If a unit contains segments without ID, only the last segment is compiled directly under the unit ID (like locize/xliff)

### Doesn't work (yet):
* Compile multiple unnamed segments into array -> only last segment will go into result (see above)
* Compile mixed (segments with and w/o id) segments into named objects (id) AND array (w/o id) -> only last segment will go into result (see above)
* TESTS!!!

### Unknown:
* Nested groups (e.g. unit in group in group)
* Other elements like `<data>`, `<ignorable>`, `<mrk>`, ...
* Edge cases like same id for a unit and group on same level (this is possible in XLIFF)

## Proposal for implementation in locize/xliff

### v6.x (Minor update, no breaking change)
* Add support for segments with IDs (as implemented here): Named objects
* Optionally also add support for multiple unnamed segments in unit: Array
* Optionally also add support for "mixed" units: Named objects (for segments with IDs) AND array (for segments w/o ID)
* Keep support for single/last (unnamed) segment for compatibility reasons: Always compile last segment in unit, directly into "source" and "target" fields of unit.

This would not cause any breaking changes if the tool is used as intended in the examples below.
Even if someone already uses IDs or multiple segments, the content of `my-unit.source` and `my-unit.target` would still be the same.

### v7 (Major update, breaking changes)
* Drop generation of additional "groupUnits" object.
* Add support of nested groups (if not already present, didn't test)
* Add support for multiple unnamed segments in unit (array), if not done in v6
* Add support for "mixed" units, if not done in v6
* Potentially, drop support for single/last segment to be compiled directly in unit to keep result structure clean. (Maybe also later)



# Original locize/xliff readme

## Download

The source is available for download from
[GitHub](https://github.com/locize/xliff/archive/master.zip).
Alternatively, you can install using npm:

```sh
npm install --save xliff
```

You can then `import` or `require()` xliff as normal:

```js
import xliff from 'xliff'
// or
const xliff = require('xliff')

xliff.xliff2js(xml, (err, res) => {})
```

Or you can directly `import` or `require()` its functions:

```js
import xliff2js from 'xliff/xliff2js'
// or
const xliff2js = require('xliff/cjs/xliff2js')
```

## Usage

##### XLIFF 2.0

```js

const xliff = `<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en-US" trgLang="de-CH">
  <file id="namespace1">
    <unit id="key1">
      <segment>
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
    </unit>
    <unit id="key2">
      <segment>
        <source>An application to manipulate and process XLIFF documents</source>
        <target>Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten</target>
      </segment>
    </unit>
    <unit id="key.nested">
      <segment>
        <source>XLIFF Data Manager</source>
        <target>XLIFF Daten Manager</target>
      </segment>
    </unit>
    <group id="group">
      <unit id="groupUnit">
        <segment>
          <source>Group</source>
          <target>Gruppe</target>
        </segment>
      </unit>
    </group>
  </file>
</xliff>`

const js = {
  "resources": {
    "namespace1": {
      "key1": {
        "source": "Hello",
        "target": "Hallo"
      },
      "key2": {
        "source": "An application to manipulate and process XLIFF documents",
        "target": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten"
      },
      "key.nested": {
        "source": "XLIFF Data Manager",
        "target": "XLIFF Daten Manager"
      },
      "group": {
        "groupUnits":{
          "groupUnit": {
            "source": "Group",
            "target": "Gruppe"
          }
        }
      }
    }
  },
  "sourceLanguage": "en-US",
  "targetLanguage": "de-CH"
}

import xliff2js from 'xliff/xliff2js'
xliff2js(xliff, (err, res) => {
  // res is like js
})
// or without callback
const res = await xliff2js(xliff)
// res is like js

import js2xliff from 'xliff/js2xliff'
js2xliff(js, (err, res) => {
  // res is like xliff
})
// or without callback
const res = await js2xliff(js)
// res is like xliff

import targetOfjs from 'xliff/targetOfjs'
const res = targetOfjs(js)
// res is:
// {
//   "key1": "Hallo",
//   "key2": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten",
//   "key.nested": "XLIFF Daten Manager",
//   "group": {
//     "groupUnit": "Gruppe"
//   }
// }

import sourceOfjs from 'xliff/sourceOfjs'
const res = sourceOfjs(js)
// res is:
// {
//   "key1": "Hello",
//   "key2": "An application to manipulate and process XLIFF documents",
//   "key.nested": "XLIFF Data Manager",
//   "group": {
//     "groupUnit": "Group"
//   }
// }

import createjs from 'xliff/createjs'
createjs(
  js.sourceLanguage,
  js.targetLanguage,
  {
    "key1": "Hello",
    "key2": "An application to manipulate and process XLIFF documents",
    "key.nested": "XLIFF Data Manager"
  },
  {
    "key1": "Hallo",
    "key2": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten",
    "key.nested": "XLIFF Daten Manager"
  },
  'namespace1',
  (err, res) => {
  // res is like js
  }
  // you can specify notes with this param (ntKeys)
  // ,{
  //    "key1": "custom note for key1",
  //    "key.nested": "another note for nested key"
  // }
)
// or without callback
//const res = await createjs(...


import createxliff from 'xliff/createxliff'
createxliff(
  js.sourceLanguage,
  js.targetLanguage,
  {
    "key1": "Hello",
    "key2": "An application to manipulate and process XLIFF documents",
    "key.nested": "XLIFF Data Manager"
  },
  {
    "key1": "Hallo",
    "key2": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten",
    "key.nested": "XLIFF Daten Manager"
  },
  'namespace1',
  (err, res) => {
  // res is like xliff  
  }  
  // you can specify notes with this param (ntKeys)
  // ,{
  //    "key1": "custom note for key1",
  //    "key.nested": "another note for nested key"
  // }
)
// or without callback
//const res = await createxliff(...
```

##### XLIFF 1.2

```js

  const xliff = `<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:tc:xliff:document:1.2 http://docs.oasis-open.org/xliff/v1.2/os/xliff-core-1.2-strict.xsd" version="1.2" srcLang="en-US" trgLang="de-CH">
    <file original="namespace1">
      <body>
        <trans-unit id="key1">
          <source>Hello</source>
          <target>Hallo</target>
        </trans-unit>
        <trans-unit id="key2">
          <source>An application to manipulate and process XLIFF documents</source>
          <target>Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten</target>
        </trans-unit>
        <trans-unit id="key.nested">
          <source>XLIFF Data Manager</source>
          <target>XLIFF Daten Manager</target>
        </trans-unit>
        <group id="group">
          <trans-unit id="groupUnit">
            <source>Group</source>
            <target>Gruppe</target>
          </trans-unit>
        </group>
      </body>
    </file>
  </xliff>`

  const js = {
    "resources": {
      "namespace1": {
        "key1": {
          "source": "Hello",
          "target": "Hallo"
        },
        "key2": {
          "source": "An application to manipulate and process XLIFF documents",
          "target": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten"
        },
        "key.nested": {
          "source": "XLIFF Data Manager",
          "target": "XLIFF Daten Manager"
        },
        "group": {
          "groupUnits":{
            "groupUnit": {
              "source": "Group",
              "target": "Gruppe"
            }
          }
        }
      }
    },
    "sourceLanguage": "en-US",
    "targetLanguage": "de-CH"
  }

  import xliff12ToJs from 'xliff/xliff12ToJs'
  xliff12ToJs(xliff, (err, res) => {
    // res is like js
  })
  // or without callback
  //const res = await xliff12ToJs(...

  import jsToXliff12 from 'xliff/jsToXliff12'
  jsToXliff12(js, (err, res) => {
    // res is like xliff
  })
  // or without callback
  //const res = await jsToXliff12(...

  import createxliff12 from 'xliff/createxliff12'
  createxliff12(
    js.sourceLanguage,
    js.targetLanguage,
    {
      "key1": "Hello",
      "key2": "An application to manipulate and process XLIFF documents",
      "key.nested": "XLIFF Data Manager"
    },
    {
      "key1": "Hallo",
      "key2": "Eine Applikation um XLIFF Dokumente zu manipulieren und verarbeiten",
      "key.nested": "XLIFF Daten Manager"
    },
    'namespace1',
    (err, res) => {
    // res is like xliff
    }
    // you can specify notes with this param (ntKeys)
    // ,{
    //    "key1": "custom note for key1",
    //    "key.nested": "another note for nested key"
    // }
  )
  // or without callback
  //const res = await createxliff12(...

```

### Using Inline Elements

XLIFF 1.2 and 2.x support the use of a set of XML elements within `source` and `target` declarations. In general these "inline" tags exist to specify special elements within translation strings. For example, in XLIFF 1.2 the `<ph>..</ph>` element is used to define a "placeholder" such as for a variable value that is substituted at runtime, e.g.:

- String: "Hello there, {fullName}"
- XLIFF 1.2: `<source>Hello there, <ph>{fullName}</ph></source>`

In the standard case described previously, the `source` and `target` values are string instances. A `source` or `target` value can also be defined as an Array instance.

```
// Simple value:
"source": "Hello there"
// Value with multiple child elements:
"source": ["Hello ", "there"]
```
(Note that in this example there's no benefit from splitting the string into two strings wrapped in an array.)

When the `source` and `target` values are Array instances, the elements of the Array contain strings (representing plain text) or objects (representing XLIFF inline elements). The structure for those objects is described next.

#### Inline element object structure

An object representing an inline element has the following structure:

```
{
  [<Element Type>]: {
    "id": "<Value>",
    "contents": "<Element Contents>",
    "<Other Property 1>": "<Other Property 1 Value>",
    ...
    "<Other Property N>": "<Other Property N Value>"
  }
}
```
The parts are:
- `<Element Type>`: A string (used as a property name) indicating the element type.
- `id` property: The value of the XLIFF element's `id` attribute
- `contents` property: The contents of the XLIFF element, if supported. This value can be a string or array and is treated like the `source`/`target` values.
- All other properties: Map directly to attributes of the XLIFF element tag

Here's a real-world example:
```
{
  "Span": {
    "id": "dataType",
    "contents": "{dataType}",
    "ctype": "x-python-brace-param"
  }
}
```
This maps to the following XLIFF inline element structure:
```
<ph id="dataType" ctype="x-python-brace-param">{dataType}</ph>
```

#### Full inline element example

The following code shows a full object structure for one type of XLIFF inline element (Generic span), and the corresponding XLIFF 1.2 and XLIFF 2.0 that it produces. For other examples of different element types, see [the inline element test fixtures](./test/fixtures/inline-elements)

##### Strings
```
key1:
source: "Hello {name}"
target: "Hallo {name}"

key2:
source: "An application to manipulate and process {doctype} documents."
target: "Eine Applikation um {doctype} Dokumente zu manipulieren und verarbeiten"
```

##### JSON
```
{
  "resources": {
    "namespace1": {
      "key1": {
        "source": [
          "Hello ",
          {
            "GenericSpan": {
              "id": "name",
              "ctype": "x-python-brace-param",
              "contents": "{name}"
            }
          }
        ],
        "target": [
          "Hallo ",
          {
            "GenericSpan": {
              "id": "name",
              "ctype": "x-python-brace-param",
              "contents": "{name}"
            }
          }
        ]
      },
      "key2": {
        "source": [
          "An application to manipulate and process ",
          {
            "GenericSpan": {
              "id": "doctype",
              "ctype": "x-python-brace-param",
              "contents": "{doctype}"
            }
          },
          " documents"
        ],
        "target": [
          "Eine Applikation um ",
          {
            "GenericSpan": {
              "id": "doctype",
              "ctype": "x-python-brace-param",
              "contents": "{doctype}"
            }
          },
          " Dokumente zu manipulieren und verarbeiten"
        ]
      }
    }
  },
  "sourceLanguage": "en-US",
  "targetLanguage": "de-CH"
}
```

##### XLIFF 1.2
```
<xliff xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:tc:xliff:document:1.2 http://docs.oasis-open.org/xliff/v1.2/os/xliff-core-1.2-strict.xsd" xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">
  <file original="namespace1" datatype="plaintext" source-language="en-US" target-language="de-CH">
    <body>
      <trans-unit id="key1">
        <source>Hello 
          <g id="name" ctype="x-python-brace-param">{name}</g>
        </source>
        <target>Hallo 
          <g id="name" ctype="x-python-brace-param">{name}</g>
        </target>
      </trans-unit>
      <trans-unit id="key2">
        <source>An application to manipulate and process 
          <g id="doctype" ctype="x-python-brace-param">{doctype}</g> documents
        </source>
        <target>Eine Applikation um 
          <g id="doctype" ctype="x-python-brace-param">{doctype}</g> Dokumente zu manipulieren und verarbeiten
        </target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

##### XLIFF 2.0
```
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en-US" trgLang="de-CH">
  <file id="namespace1">
    <unit id="key1">
      <segment>
        <source>Hello 
          <pc id="name" ctype="x-python-brace-param">{name}</pc>
        </source>
        <target>Hallo 
          <pc id="name" ctype="x-python-brace-param">{name}</pc>
        </target>
      </segment>
    </unit>
    <unit id="key2">
      <segment>
        <source>An application to manipulate and process 
          <pc id="doctype" ctype="x-python-brace-param">{doctype}</pc> documents
        </source>
        <target>Eine Applikation um 
          <pc id="doctype" ctype="x-python-brace-param">{doctype}</pc> Dokumente zu manipulieren und verarbeiten
        </target>
      </segment>
    </unit>
  </file>
</xliff>
```

#### Supported inline element types

XLIFF 1.2 and XLIFF 2.x define different sets of inline elements. However, the underlying semantics of many of the elements are the same and they can be mapped to each other. The supported element types are:

| Element type | Use Case | Representation (1.2) | Representation (2.0) |
| ------------ | -------- | -------------------- | -------------------- |
| **Generic** |
| Standalone | Standalone code | `<x/>` | `<ph/>` | 
| GenericSpan | Well-formed spanning code | `<g></g>` | `<pc></pc>` |
| GenericSpanStart | Start marker of spanning code | `<bx/>` | `<sc/>` |
| GenericSpanEnd | End marker of spanning code | `<ex/>` | `<ec/>` |
| **Native code** (same as generic for 2.0) | |  |
| Span | Well-formed spanning code | `<ph></ph>` | `<pc></pc>` |
| SpanStart | Start marker of spanning code | `<bpt></bpt>` | `<sc/>` |
| SpanEnd | End marker of spanning code | `<ept></ept>` | `<ec/>` |

  Note that there are additional inline elements defined in the XLIFF specifications that are not supported by this library, and are not listed here.

These types are defined as constants in [inline-elements/ElementTypes.js](./inline-elements/ElementTypes.js)

Although both XLIFF versions define Generic element types, only XLIFF 1.2 defines Native element types. This library uses a "superset" approach to allow for compatibility between its data model and the different XLIFF versions. For example, an object representation of an XLIFF value that includes a `Span` (Native spanning code) is converted to a `<pc>..</pc>` element in XLIFF 2.0, even though XLIFF 2.0 doesn't technically support Native elements.

The rules for mapping between element types are as follows:

JS -> XLIFF 1.2
  Elements are written as their corresponding types

JS -> XLIFF 2.0
  Elements are written as their corresponding types. Native/generic types are mapped to the same XLIFF element type

XLIFF 1.2 -> JS
  Elements are read as their corresponding types

XLIFF 2.0 -> JS
  Elements are read as their corresponding (non-generic) types

As a result, you should be able to have "roundtrip" support for converting between JavaScript and XLIFF. The only exception is if an XLIFF 1.2 value is converted to JavaScript, then to XLIFF 2, then back to JavaScript, then to XLIFF 1.2. In that case the Native inline elements will be converted to XLIFF 1.2 Generic elements.

#### Helpers for creating inline element objects

If you need to create your own inline element objects to construct a `source` or `target` array, you can use the [`makeInlineElement()`](./lib/inline-elements/makeInlineElement.js) function.

For example, suppose you have this string:

> "Hello {name}"

You want to use it as a `source` value containing two parts -- the string "Hello " and a Generic Span element containing the placeholder variable "{name}", so that the end result (in XLIFF 1.2) should look like this:

```
<source>Hello 
  <g id="name" ctype="x-python-brace-param">{name}</g>
</source>
```

You can create this structure using the `makeInlineElement()` function with the following code:

```
// import or require makeInlineElements and ElementTypes
// signature: makeInlineElement(type, id, attributes, contents)
var attributesObj = { ctype: 'x-python-brace-param' }
var inlineElementObj = makeInlineElement(ElementTypes.GenericSpan, 'name', attributesObj, '{name}')

var source = [ 'Hello ', inlineElementObj ]
```

### Additional attributes example
It is possible to pass `additionalAttributes` to your js file. These will be added to the `<trans-unit>` element in xliff:

```js
const js = {
  "resources": {
    "namespace1": {
      "key1": {
        "source": "Hello",
        "target": "Hallo",
        "additionalAttributes": {
          "translate": "no",
          "approved": "yes"
        }
      }
    }
  }
}
```

Of course, this also works the other way around:
```js
const xliff = `<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en-US" trgLang="de-CH">
  <file id="namespace1">
    <unit id="key1" translate="no" approved="yes">
      <segment>
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
    </unit>
  </file>
</xliff>`
```
