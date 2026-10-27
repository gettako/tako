import { describe, expect, it } from "bun:test"
import { resolveOsInfo, DockerIcon, OsIcon } from "@/components/ui/os-icon"

describe("OS and Container Brand Icons", () => {
  it("resolves popular server OS distributions accurately", () => {
    expect(resolveOsInfo("Ubuntu 24.04.1 LTS").label).toBe("Ubuntu")
    expect(resolveOsInfo("ubuntu-server").color).toBe("#E95420")

    expect(resolveOsInfo("Debian GNU/Linux 12").label).toBe("Debian")
    expect(resolveOsInfo("debian").color).toBe("#A81D33")

    expect(resolveOsInfo("Rocky Linux 9.3").label).toBe("Rocky Linux")
    expect(resolveOsInfo("rocky").color).toBe("#10B981")

    expect(resolveOsInfo("AlmaLinux 9.2").label).toBe("AlmaLinux")
    expect(resolveOsInfo("almalinux").color).toBe("#1060FF")

    expect(resolveOsInfo("Alpine Linux v3.19").label).toBe("Alpine Linux")
    expect(resolveOsInfo("alpine").color).toBe("#0D597F")

    expect(resolveOsInfo("Red Hat Enterprise Linux 9").label).toBe("Red Hat")
    expect(resolveOsInfo("rhel 9.2").color).toBe("#EE0000")

    expect(resolveOsInfo("CentOS Stream 9").label).toBe("CentOS")
    expect(resolveOsInfo("centos").color).toBe("#262577")

    expect(resolveOsInfo("Fedora 39").label).toBe("Fedora")
    expect(resolveOsInfo("fedora").color).toBe("#51A2DA")

    expect(resolveOsInfo("Arch Linux").label).toBe("Arch Linux")
    expect(resolveOsInfo("arch").color).toBe("#1793D1")

    expect(resolveOsInfo("openSUSE Leap 15.5").label).toBe("openSUSE")
    expect(resolveOsInfo("suse").color).toBe("#73BA25")

    expect(resolveOsInfo("FreeBSD 14.0").label).toBe("FreeBSD")
    expect(resolveOsInfo("freebsd").color).toBe("#AB2B28")

    expect(resolveOsInfo("Darwin 23.4.0").label).toBe("macOS")
    expect(resolveOsInfo("macos").color).toBe("#A2AAAD")

    // Fallback
    expect(resolveOsInfo("unknown-os").label).toBe("Linux")
    expect(resolveOsInfo(undefined).label).toBe("Linux")
  })

  it("exports valid OsIcon and DockerIcon components", () => {
    expect(typeof OsIcon).toBe("function")
    expect(typeof DockerIcon).toBe("function")
  })
})
