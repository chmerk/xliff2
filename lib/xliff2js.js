import convert from 'xml-js'
import ElementTypes2 from './inline-elements/ElementTypes2.js'
import { extractValue } from './xml-js/xmlToObject.js'

const xliffToJsClb = (str, options, cb) => {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }
  options = options || {}
  if (typeof str !== 'string') {
    const err = new Error('The first parameter was not a string')
    if (cb) return cb(err)
    return err
  }

  const result = {}

  let xmlObj
  try {
    xmlObj = convert.xml2js(str, {})
  } catch (err) {
    if (cb) return cb(err)
    return err
  }

  const xliffRoot = xmlObj.elements.find((ele) => ele.name === 'xliff')

  if (xliffRoot.attributes) {
    const srcLang = xliffRoot.attributes.srcLang
    const trgLang = xliffRoot.attributes.trgLang

    result.sourceLanguage = srcLang
    result.targetLanguage = trgLang
    if (!result.targetLanguage) delete result.targetLanguage

    xliffRoot.elements = xliffRoot.elements.filter((child) => child.type !== 'comment')
    result.resources = xliffRoot.elements.reduce((resources, file) => {
      const namespace = options.namespace || file.attributes.id

      const initValues = { /* source: '', target: '' */}
      if (!result.targetLanguage) delete initValues.target

      // namespace
      file.elements = file.elements || []
      file.elements = file.elements.filter(
        (child) => child.type !== 'comment'
      )
      resources[namespace] = createUnits(file, initValues)

      return resources
    }, {})
  }

  if (cb) return cb(null, result)
  return result
}

function createUnits (parent, initValues) {
  if (!parent.elements) return {}
  return parent.elements.reduce((file, unit) => {
    let key
    let additionalAttributes = {}
    if (unit.name === 'notes') {
      key = 'notes'
    } else {
      key = unit.attributes.id

      additionalAttributes = unit.attributes
      delete additionalAttributes.id
    }

    switch (unit.name) {
      case 'notes':
        if (!file.notes) {
          file.notes = []
        }
        unit.elements.forEach((noteElement) => {
          file.notes.push(noteElement.elements[0].text)
        })
        return file

      case 'unit':
        file[key] = createUnit(unit, initValues)
        if (Object.keys(additionalAttributes).length) {
          Object.assign(file[key], { additionalAttributes })
        }
        return file

      case 'group':
        file[key] = createUnits(unit, initValues)
        if (Object.keys(additionalAttributes).length) {
          Object.assign(file[key], { additionalAttributes })
        }
        return file

      default:
        return file
    }
  }, {})
}

function createUnit (unit, initValues) {
  // source, target, note
  if (!unit.elements) return undefined

  const jsonUnit = {}
  let allSegmentsHaveId = true
  // Iterate first time:
  // - Check if all segments have an ID
  // - Transfer notes
  unit.elements.forEach((element) => {
    if (element.name === 'notes') {
      if (!jsonUnit.notes) {
        jsonUnit.notes = []
      }
      element.elements.forEach((noteElement) => {
        jsonUnit.notes.push(noteElement.elements[0].text)
      })
    }
    if (element.name === 'segment') {
      if (!(element.attributes) || !(element.attributes.id)) {
        allSegmentsHaveId = false
      }
    }
  })

  if (allSegmentsHaveId) {
    unit.elements.forEach((element) => {
      if (element.name === 'segment') {
        jsonUnit[element.attributes.id] = createSegmentWithId(element)
      }
    })
  } else {
    return createSegment(unit, initValues)
  }
  return jsonUnit
}

function createSegmentWithId (segmentElement) {
  const segment = {}
  segmentElement.elements.forEach((element) => {
    const value = extractValue(element.elements, ElementTypes2)
    segment[element.name] = value
  })
  return segment
}

function createSegment (unit, initValues) {
  // ToDo: Eventually all segments should probably be created with the same method?!?
  return unit.elements.reduce((unit, segment) => {
    console.log('SEGMENT:', segment)

    // if (['segment', 'notes'].indexOf(segment.name) < 0) return unit

    segment.elements.forEach((element) => {
      const value = extractValue(element.elements, ElementTypes2)
      switch (element.name) {
        case 'source':
        case 'target':
          unit[element.name] = value
          break
        case 'note':
          if (unit[element.name]) {
            if (!Array.isArray(unit[element.name])) {
              unit[element.name] = [unit[element.name]]
            }
            unit[element.name].push(value)
          } else {
            unit[element.name] = value
          }
          break
      }
    })
    return unit
  }, JSON.parse(JSON.stringify(initValues)))
}

export default function xliffToJs (str, options, cb) {
  if (!cb && options === undefined) {
    return new Promise((resolve, reject) => xliffToJsClb(str, options, (err, ret) => err ? reject(err) : resolve(ret)))
  }
  if (!cb && typeof options !== 'function') {
    return new Promise((resolve, reject) => xliffToJsClb(str, options, (err, ret) => err ? reject(err) : resolve(ret)))
  }
  xliffToJsClb(str, options, cb)
}
