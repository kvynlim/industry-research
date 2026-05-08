# On-Vehicle Supply Chain and Runtime Security Operations

**Last updated:** 2026-05-09

On-vehicle runtime security starts before the vehicle boots. Every deployed binary, container image, model, map, calibration file, configuration bundle, firmware package, and script is a supply-chain artifact. The operational goal is to prove what is running, where it came from, whether it is vulnerable, whether it was authorized for that vehicle and ODD, and whether it has changed at runtime.

## Practical Evidence and Artifact Model

| Artifact | Contents | Operational use |
|---|---|---|
| Software bill of materials | Packages, libraries, containers, OS image, firmware, model runtime, licenses, hashes | CVE triage, supplier review, incident scope |
| VEX or vulnerability disposition | CVE affected/not affected, exploitability, fix plan, compensating controls, owner, SLA | Avoids blind patching and proves triage |
| Provenance attestation | Source repo, commit, builder identity, build recipe, dependencies, timestamp, SLSA level | Detects tampering and unapproved builds |
| Signature record | Artifact digest, signer identity, signing key/certificate, transparency log or HSM record | Enforces deployment policy |
| Vehicle deployment manifest | Vehicle ID, active OS/app/model/map/config/calibration versions, compatible rollback set | Incident reconstruction and rollback |
| Secure boot attestation | Bootloader, kernel, rootfs hash, dm-verity status, measured boot PCRs, TPM quote if available | Proves boot chain integrity |
| Secrets inventory | Certificates, API tokens, device keys, rotation dates, storage location, revocation path | Prevents fleet lockout and credential sprawl |
| Runtime integrity report | File integrity, container digest, process allowlist, kernel module list, debug port state | Detects unauthorized changes |
| Supplier security file | ISO/SAE 21434 interface agreements, SBOM, patch SLA, vulnerability disclosure contact | Manages third-party risk |

The vehicle should report a signed version manifest at startup, after update, and during incident evidence capture. The manifest should include software, firmware, model, map, calibration, and configuration identifiers, not only application version.

## Deployment Operations

### 1. Build and release controls

- Use reproducible or hermetic builds where practical.
- Generate SBOMs for OS images, containers, firmware packages, and application bundles.
- Sign all artifacts before they enter the release repository.
- Attach provenance attestations to build outputs.
- Enforce policy in CI: no unsigned artifacts, no unknown base images, no critical unfixed vulnerabilities without an accepted exception, no secrets in artifacts.
- Keep source, build, and release duties separated for safety-critical components.

NIST SP 800-218 SSDF provides the secure development process vocabulary. SLSA, in-toto, Sigstore, TUF, and Uptane provide practical mechanisms for provenance, signing, secure update metadata, and automotive-style update resilience.

### 2. Vehicle install controls

On-vehicle update agents should:

1. Verify transport security and server identity.
2. Verify signed update metadata and artifact digest.
3. Verify artifact compatibility with vehicle hardware, ECU, map schema, model runtime, calibration schema, and ODD.
4. Check anti-rollback rules unless an approved emergency rollback exception is present.
5. Install atomically to an inactive slot or staging area.
6. Run first-boot health checks.
7. Report a signed version manifest.

Uptane's model of primary and secondary ECUs, vehicle manifests, signed metadata, secure time, and rollback/replay resistance is directly relevant even when the fleet is not road-type-approved.

### 3. Runtime controls

| Control | Vehicle implementation |
|---|---|
| Secure boot | Hardware root of trust, locked bootloader, measured boot, dm-verity or equivalent rootfs integrity |
| Least privilege | Non-root containers, capability drops, read-only filesystems, no privileged debug shells in production |
| Network segmentation | External links cannot route directly to CAN, safety PLC, sensor Ethernet, or ROS control topics |
| Certificate management | TPM/HSM-backed keys, rotation calendar, emergency revocation, overlap period before expiry |
| Runtime allowlist | Expected processes, container digests, kernel modules, listening ports |
| Secret handling | No secrets in bags/logs/core dumps; secret scanner in upload pipeline |
| Local forensic mode | Preserve logs, manifests, and volatile state before recovery actions |

### 4. Vulnerability operations

Fleet CVE triage must be version-aware and vehicle-aware:

- Ingest CVEs for OS packages, containers, ROS/DDS middleware, CUDA/TensorRT, ML frameworks, web services, OTA clients, and vendor firmware.
- Join CVEs to SBOMs and active vehicle manifests.
- Rank by exploitability, exposure, safety impact, compensating controls, and fleet blast radius.
- Use VEX-style dispositions for "not affected" or "affected but mitigated" decisions.
- Track patch SLA separately for internet-exposed cloud components, vehicle external interfaces, internal vehicle dependencies, and lab-only tools.

### 5. Key and certificate operations

Expired or compromised credentials can stop a fleet as effectively as a software bug. Maintain:

- Device certificate inventory with expiry, issuer, vehicle ID, and revocation status.
- Signing-key ceremony and backup process.
- Emergency key compromise playbook.
- Clock-source integrity checks because secure update frameworks depend on time freshness.
- Rotation drills before certificates approach expiry.

## Risks and Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Compromised build server signs malicious artifact | Fleet-wide malicious update | Hardened builders, provenance, two-person release, signing key isolation |
| Unsigned local patch applied during field support | Unknown runtime state and invalid safety evidence | Production vehicles reject unsigned artifacts; support actions logged |
| SBOM exists but is not linked to active vehicles | CVE scope cannot be determined | Vehicle manifests feed SBOM/CVE join table |
| Model or map not treated as software | Poisoned or wrong artifact bypasses signing and rollout controls | Unified artifact policy for code, model, map, config, calibration |
| Rollback attack | Vehicle runs known-vulnerable version | Uptane/TUF metadata, secure time, anti-rollback counters |
| Certificate expiry | Fleet loses telemetry, OTA, or command channel | Expiry dashboards, rotation windows, overlap certs |
| Secrets in logs or bags | Cloud or vehicle compromise | Secret scanning and rotation; no secret-bearing env dumps |
| Container breakout | Attacker reaches host or CAN bridge | Non-privileged containers, AppArmor/SELinux, network segmentation |
| Debug interfaces left enabled | Physical access compromise | Secure service mode, sealed ports, maintenance authentication |

## Related Repository Docs

- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`
- `50-cloud-fleet/ota/software-update-management-system-ops.md`
- `50-cloud-fleet/ota/ota-fleet-management.md`
- `40-runtime-systems/ml-deployment/production-ml-deployment.md`
- `40-runtime-systems/ros-autoware/ros2-migration.md`
- `50-cloud-fleet/data-governance/fleet-data-privacy-governance.md`
- `60-safety-validation/runtime-assurance/fail-operational-architecture.md`

## Sources

- NIST SP 800-218, "Secure Software Development Framework (SSDF) Version 1.1," 2022-02-03. https://csrc.nist.gov/pubs/sp/800/218/final
- NIST SP 800-161 Revision 1, "Cybersecurity Supply Chain Risk Management Practices for Systems and Organizations." https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final
- ISO/SAE 21434:2021, "Road vehicles - Cybersecurity engineering." https://www.iso.org/standard/70918.html
- Vehicle Certification Agency, "Cyber Security and Software Updating," last updated 2024-05-14. https://www.vehicle-certification-agency.gov.uk/connected-and-automated-vehicles/cyber-security-and-software-updating/
- UNECE UN Regulation No. 156, software update and software update management system. https://unece.org/transport/documents/2021/03/standards/un-regulation-no-156-software-update-and-software-update
- ISO 24089:2023, "Road vehicles - Software update engineering." https://www.iso.org/standard/77796.html
- Uptane Standard 2.0.0. https://uptane.org/docs/2.0.0/standard/uptane-standard
- The Update Framework. https://theupdateframework.org/
- SLSA, "Supply-chain Levels for Software Artifacts." https://slsa.dev/
- Sigstore overview. https://docs.sigstore.dev/about/overview/
- in-toto documentation. https://in-toto.io/docs/getting-started/
- CISA, Software Bill of Materials. https://www.cisa.gov/sbom
