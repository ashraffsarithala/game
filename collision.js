export function computeLandingDistance({ hexRadius, blockSize, stackHeight }) {
  // blocks "stack" outward from the hex edge
  return hexRadius + stackHeight * blockSize + blockSize * 0.5;
}

export function isGameOverStack({ stackHeight, maxBlocksToCenter }) {
  // If a stack reaches the center, game over.
  // In this simplified geometry model, we cap by block count.
  return stackHeight >= maxBlocksToCenter;
}

