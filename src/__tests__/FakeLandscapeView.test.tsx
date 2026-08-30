import { render, screen } from '@testing-library/react'
import { View } from 'react-native'

import { FakeLandscapeView } from '../FakeLandscapeView'

describe('FakeLandscapeView', () => {
  beforeEach(() => {
    ;(View as unknown as jest.Mock).mockClear()
  })

  it('renders children directly under the passed style, unrotated, when rotation is 0 (faceToFace, right-side-up)', () => {
    const style = { backgroundColor: 'red' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={false} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toBe(style)
  })

  it('ignores p1OnRight for the 0° faceToFace case', () => {
    const style = { backgroundColor: 'blue' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={true} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toBe(style)
  })

  it('flips 180° in place when faceToFace and upsideDown', () => {
    const style = { backgroundColor: 'green' }
    render(
      <FakeLandscapeView orientationMode='faceToFace' p1OnRight={false} upsideDown={true} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0].style).toEqual([style, { transform: [{ rotate: '180deg' }] }])
  })

  it('rotates 90° and swaps width/height when sideBySide with p1 on the left', () => {
    const style = { backgroundColor: 'yellow' }
    render(
      <FakeLandscapeView orientationMode='sideBySide' p1OnRight={false} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)

    const [outerProps, innerProps] = calls.map((call) => call[0])
    expect(outerProps.style).toBeUndefined()
    expect(outerProps.pointerEvents).toBe('box-none')

    const innerStyleArray = innerProps.style as unknown[]
    const computedStyle = innerStyleArray[innerStyleArray.length - 1]
    expect(computedStyle).toEqual({
      height: 402,
      left: (402 - 874) / 2,
      top: (874 - 402) / 2,
      transform: [{ rotate: '90deg' }],
      width: 874
    })
  })

  it('rotates -90° and swaps width/height when sideBySide with p1 on the right', () => {
    const style = { backgroundColor: 'yellow' }
    render(
      <FakeLandscapeView orientationMode='sideBySide' p1OnRight={true} upsideDown={false} style={style}>
        hello
      </FakeLandscapeView>
    )

    expect(screen.getByText('hello')).toBeTruthy()

    const calls = (View as unknown as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)

    const [outerProps, innerProps] = calls.map((call) => call[0])
    expect(outerProps.style).toBeUndefined()
    expect(outerProps.pointerEvents).toBe('box-none')

    const innerStyleArray = innerProps.style as unknown[]
    const computedStyle = innerStyleArray[innerStyleArray.length - 1]
    expect(computedStyle).toEqual({
      height: 402,
      left: (402 - 874) / 2,
      top: (874 - 402) / 2,
      transform: [{ rotate: '-90deg' }],
      width: 874
    })
  })
})
