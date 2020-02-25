import { findElements } from '@fullcalendar/core'
import { ensureDate, formatIsoWithoutTz } from 'standard-tests/src/lib/datelib-utils'
import { getBoundingRect } from 'standard-tests/src/lib/dom-geom'
import { getRectCenter, addPoints } from 'standard-tests/src/lib/geom'


export default class TimelineGridWrapper {

  constructor(public el: HTMLElement) {
  }


  clickDate(date) { // not JUST a date. a resource too
    let point = this.getPoint(date)

    if ($(this.el).css('direction') === 'ltr') {
      point.left += 1
    } else {
      point.left -= 1
    }

    return new Promise((resolve) => {
      $.simulateByPoint('drag', {
        point,
        onRelease: () => resolve()
      })
    })
  }


  resizeEvent(eventEl: HTMLElement, newEndDate, fromStart?) {
    return new Promise((resolve) => {
      let $eventEl = $(eventEl)
      $eventEl.simulate('mouseover') // resizer only shows on hover

      let eventRect = eventEl.getBoundingClientRect()
      let isRtl = $eventEl.css('direction') === 'rtl'
      let resizerEl = eventEl.querySelector(fromStart ? '.fc-start-resizer' : '.fc-end-resizer')
      let resizerPoint = getRectCenter(resizerEl.getBoundingClientRect())
      let xCorrect = resizerPoint.left - (isRtl ? eventRect.left : eventRect.right)
      let destPoint = this.getPoint(newEndDate)
      destPoint = addPoints(destPoint, { left: xCorrect, top: 0 })

      $(resizerEl).simulate('drag', {
        end: destPoint,
        onRelease: () => resolve()
      })
    })
  }


  getHighlightEls() {
    return findElements(this.el, '.fc-highlight')
  }


  getEventEls() { // FG events
    return findElements(this.el, '.fc-event')
  }


  getFirstEventEl() {
    return this.el.querySelector('.fc-event') as HTMLElement
  }


  getMirrorEventEls() {
    return findElements(this.el, '.fc-mirror')
  }


  getNonBusinessDayEls() {
    return findElements(this.el, '.fc-nonbusiness')
  }


  getSlatEls() {
    return findElements(this.el, '.fc-slats td')
  }


  getSlatElByDate(dateOrStr) { // prefers string. we do this because all-day doesnt have 00:00:00
    if (typeof dateOrStr !== 'string') {
      dateOrStr = formatIsoWithoutTz(ensureDate(dateOrStr))
    }
    return this.el.querySelector('.fc-slats td[data-date="' + dateOrStr + '"]')
  }


  getRect(start, end) {
    let coord0 = this.getLeft(start)
    let coord1 = this.getLeft(end)
    let canvasRect = getBoundingRect($('.fc-body .fc-time-area .fc-timeline-grid'))

    return {
      left: Math.min(coord0, coord1),
      right: Math.max(coord0, coord1),
      top: canvasRect.top,
      bottom: canvasRect.bottom
    }
  }


  getLine(date) {
    let contentRect = getBoundingRect(this.el)
    let left = this.getLeft(date)

    return {
      left,
      right: left,
      top: contentRect.top,
      bottom: contentRect.bottom
    }
  }


  getPoint(date) {
    let contentRect = getBoundingRect(this.el)
    let left = this.getLeft(date)

    return {
      top: (contentRect.top + contentRect.bottom) / 2,
      left
    }
  }


  getLeft(targetDate) {
    targetDate = ensureDate(targetDate)

    let slatCoord
    let isRtl = $(this.el).css('direction') === 'rtl'
    let slatEl = this.getSlatElByDate(targetDate)

    const getLeadingEdge = function(cellEl) {
      let cellRect = cellEl.getBoundingClientRect()
      return isRtl ? cellRect.right : cellRect.left
    }

    const getTrailingEdge = function(cellEl) {
      let cellRect = cellEl.getBoundingClientRect()
      return isRtl ? cellRect.left : cellRect.right
    }

    if (slatEl) {
      return getLeadingEdge(slatEl)
    }

    let slatEls = this.getSlatEls()
    let slatDate = null
    let prevSlatDate = null

    for (let i = 0; i < slatEls.length; i++) { // traverse earlier to later
      slatEl = slatEls[i]

      prevSlatDate = slatDate
      slatDate = ensureDate(slatEl.getAttribute('data-date'))

      // is target time between start of previous slat but before this one?
      if (targetDate < slatDate) {
        // before first slat
        if (!prevSlatDate) {
          return getLeadingEdge(slatEl)
        } else {
          const prevSlatEl = slatEls[i - 1]
          const prevSlatCoord = getLeadingEdge(prevSlatEl)
          slatCoord = getLeadingEdge(slatEl)
          return prevSlatCoord +
            ((slatCoord - prevSlatCoord) *
            ((targetDate - prevSlatDate.valueOf()) / (slatDate.valueOf() - prevSlatDate.valueOf())))
        }
      }
    }

    // target date must be after start date of last slat
    // `slatDate` is set to the start date of the last slat

    // guess the duration of the last slot, based on previous duration
    const slatMsDuration = slatDate.valueOf() - prevSlatDate.valueOf()

    slatCoord = getLeadingEdge(slatEl)
    const slatEndCoord = getTrailingEdge(slatEl)

    return slatCoord + // last slat's starting edge
      ((slatEndCoord - slatCoord) *
      Math.min(1, (targetDate - slatDate.valueOf()) / slatMsDuration)) // don't go past the last slat
  }


  hasNowIndicator() {
    return Boolean(this.getNowIndicatorEl())
  }


  getNowIndicatorEl() {
    return this.el.querySelector('.fc-now-indicator-line')
  }


  getBgEventEls() {
    return findElements(this.el, '.fc-bgevent')
  }

}
