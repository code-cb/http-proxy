import { requiresPort } from '../src';

describe(`requiresPort`, () => {
  test(`empty ports are not required`, () => {
    ['http', 'wss', 'ws', 'file', 'foo', 'bar'].forEach(protocol =>
      expect(requiresPort('', protocol)).toBe(false),
    );
  });

  test(`non-empty ports are required for unknown protocols`, () => {
    expect(requiresPort('808', 'foo')).toBe(true);
    expect(requiresPort('80', 'bar')).toBe(true);
  });

  test(`ports are never required for file`, () => {
    ['80', '8080'].forEach(port =>
      expect(requiresPort(port, 'file')).toBe(false),
    );
  });

  interface TestCase {
    defaultPort: number;
    protocolName: string;
    protocolVariants: string[];
    requiredPorts: number[];
  }

  const testCases: TestCase[] = [
    {
      defaultPort: 80,
      protocolName: 'http',
      protocolVariants: ['http', 'http://', 'http://www.google.com'],
      requiredPorts: [8080],
    },
    {
      defaultPort: 80,
      protocolName: 'ws',
      protocolVariants: ['ws', 'ws://', 'ws://www.google.com'],
      requiredPorts: [8080],
    },
    {
      defaultPort: 443,
      protocolName: 'https',
      protocolVariants: ['https', 'https://', 'https://www.google.com'],
      requiredPorts: [8080],
    },
    {
      defaultPort: 443,
      protocolName: 'wss',
      protocolVariants: ['wss', 'wss://', 'wss://www.google.com'],
      requiredPorts: [8080],
    },
    {
      defaultPort: 21,
      protocolName: 'ftp',
      protocolVariants: ['ftp', 'ftp://', 'ftp://www.google.com'],
      requiredPorts: [8080],
    },
    {
      defaultPort: 70,
      protocolName: 'gopher',
      protocolVariants: ['gopher', 'gopher://', 'gopher:///www.google.com'],
      requiredPorts: [8080],
    },
  ];

  test.each(testCases)(
    `port $defaultPort is not required for $protocolName`,
    ({ defaultPort, protocolVariants, requiredPorts }) =>
      protocolVariants.forEach(protocol => {
        expect(requiresPort(defaultPort, protocol)).toBe(false);
        expect(requiresPort(String(defaultPort), protocol)).toBe(false);
        requiredPorts.forEach(port => {
          expect(requiresPort(port, protocol)).toBe(true);
          expect(requiresPort(String(port), protocol)).toBe(true);
        });
      }),
  );
});
