//go:build !premium

package webui

import (
	"embed"
	"io/fs"
)

//go:embed dist-community
var dist embed.FS

func DistFS() (fs.FS, error) {
	return fs.Sub(dist, "dist-community")
}
