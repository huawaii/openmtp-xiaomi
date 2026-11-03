import { execFile } from 'child_process';
import { log } from '../utils/log';

/**
 * macOS starts these Image Capture daemons on demand for any device exposing
 * an MTP/PTP (still image, class 6) interface, and they hold that interface
 * exclusively. While they hold it, libusb cannot claim interface 0:
 * `ClaimInterface` returns `LIBUSB_ERROR_ACCESS`, the first transfer then fails
 * with `LIBUSB_ERROR_NOT_FOUND`, and Kalam reports `ErrorDeviceSetup`.
 *
 * See https://github.com/ganeshrvel/openmtp/pull/483 and issue #276.
 */
export const MTP_INTERFACE_CLAIMANTS = ['ptpcamerad', 'mscamerad-xpc'];

const IOREG_PATH = '/usr/sbin/ioreg';
const PKILL_PATH = '/usr/bin/pkill';

function execFileAsync(file, args) {
  return new Promise((resolve) => {
    try {
      execFile(file, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
        resolve({ error, stdout: stdout ?? '' });
      });
    } catch (error) {
      resolve({ error, stdout: '' });
    }
  });
}

/**
 * description - Check whether a USB interface named "MTP" is currently held
 * by one of the macOS Image Capture daemons.
 *
 * Restricting the match to MTP-named interfaces keeps us from touching the
 * daemons while they serve an iPhone or a camera (those expose "PTP").
 *
 * @return {Promise<boolean|null>} null when ioreg could not be read
 */
export async function isMtpInterfaceHeldBySystem() {
  const { error, stdout } = await execFileAsync(IOREG_PATH, [
    '-r',
    '-c',
    'IOUSBHostInterface',
    '-l',
    '-w0',
  ]);

  if (error) {
    return null;
  }

  // with '-r' every matched interface starts a new top-level '+-o' block
  const blocks = stdout.split(/^\+-o /m);

  return blocks.some((block) => {
    const name = /"kUSBString" = "([^"]*)"/.exec(block)?.[1] ?? '';
    const owner = /"UsbExclusiveOwner" = "([^"]*)"/.exec(block)?.[1] ?? '';

    if (!/mtp/i.test(name)) {
      return false;
    }

    return MTP_INTERFACE_CLAIMANTS.some((claimant) =>
      new RegExp(`(^|[\\s,])${claimant}$`).test(owner)
    );
  });
}

/**
 * description - End one claimant by exact process name.
 *
 * '-x' matches the process name exactly, so unrelated daemons such as
 * 'appleh13camerad' are never touched. SIGKILL is required: these daemons
 * ignore SIGTERM while pkill still exits 0 for having signalled them.
 *
 * @param name
 * @return {Promise<{name: string, killed: boolean}>}
 */
async function killByExactName(name) {
  const { error } = await execFileAsync(PKILL_PATH, ['-9', '-x', name]);

  // pkill exits 1 when nothing matched, which is not a failure for us
  return { name, killed: !error, code: error?.code ?? 0 };
}

/**
 * description - Hand the MTP interface back from the macOS Image Capture
 * daemons.
 *
 * Both run as the current user and launchd restarts them on demand, so ending
 * them is reversible. launchd brings them back within about a second and they
 * reclaim the interface immediately, so the caller must start the MTP
 * handshake right after this resolves, with nothing awaited in between.
 *
 * Callers: before the first handshake when ioreg shows the interface held by
 * the daemons, and before each retry after a failed handshake.
 *
 * @return {Promise<boolean>} whether anything was actually killed
 */
export async function releaseMtpInterfaceClaimants() {
  const results = await Promise.all(
    MTP_INTERFACE_CLAIMANTS.map((name) => killByExactName(name))
  );

  const released = results.some((item) => item.killed);

  // written to the log file so this is diagnosable from a packaged build
  log.info(
    `released=${released} ${JSON.stringify(results)}`,
    'releaseMtpInterfaceClaimants',
    true,
    true,
    false
  );

  return released;
}
