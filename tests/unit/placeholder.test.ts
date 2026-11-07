describe('foundation', () => {
  it('runs vitest under happy-dom', () => {
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });
});
