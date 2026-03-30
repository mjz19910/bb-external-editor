export function mvExtended(ns: NS, file: string, destPath: string, server: string = "home") {
    const supportedExtensions = [".js", ".ts", ".jsx", ".tsx", ".txt", ".json", ".css"]
    const isSupported = supportedExtensions.some(ext => file.endsWith(ext))

    // Extract the base file name
    const fileName = file.split("/").pop() || file

    // If destPath ends with /, treat as directory and append the basename
    const finalDest = destPath.endsWith("/") ? `${destPath}${fileName}` : destPath

    // Moving on home
    if (server === "home") {
        if (!isSupported) {
            ns.tprint(`Skipping unsupported file on home: ${file}`)
            return
        }

        try {
            ns.mv("home", file, finalDest)
            ns.tprint(`Moved ${file} → ${finalDest}`)
        } catch (e) {
            ns.tprint(`Could not move ${file} on home: ${e}`)
        }
        return
    }

    // Moving from cloud server
    try {
        if (!isSupported) {
            // Copy unsupported files from cloud server to home
            ns.scp(file, "home", server)
            ns.rm(file, server)
            ns.tprint(`Copied unsupported file ${file} from ${server} → home`)
            return
        }

        // Copy supported file to home first
        ns.scp(file, "home", server)
        ns.mv("home", file, finalDest)
        ns.rm(file, server)
        ns.tprint(`Moved ${file} from ${server} → ${finalDest}`)
    } catch (e) {
        ns.tprint(`Failed to move ${file} from ${server}: ${e}`)
    }
}