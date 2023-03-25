import { render } from '@testing-library/react';

import Resource from './resource';

// window.matchMedia() is used in the render() method at line 22
// JSDOM hasn't implemented window.matchMedia()
// the test will fail due to the above reason and Jest return a TypeError
// Therefore mocking of the matchMedia need to be done like below

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
  });

describe('Mavu', () => {
    it('should render successfully', () => {
        const { baseElement } = render(<Resource />);
        expect(baseElement).toBeTruthy();
    });
});
