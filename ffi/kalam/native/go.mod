module kalam

go 1.16

require (
	github.com/ganeshrvel/go-mtpfs v1.0.4-0.20240426083057-1c3302b3c476
	github.com/ganeshrvel/go-mtpx v0.0.0-20240426092756-18f12db021cc
	github.com/json-iterator/go v1.1.12
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
)

// [openmtp-xiaomi] patched copy of go-mtpfs: Configure() no longer leaks a
// claimed USB handle when the session cannot be opened after a reset, and it
// closes a stale session left behind by macOS ptpcamerad. See
// third_party/go-mtpfs/mtp/mtp.go.
replace github.com/ganeshrvel/go-mtpfs => ./third_party/go-mtpfs

///##### Upgrade a package
//go get github.com/<org-name>/<package-name>@<git-commit-hash>

//example: go get github.com/ganeshrvel/go-mtpfs@<git-commit-hash>
//example: go get github.com/ganeshrvel/go-mtpx@<git-commit-hash>

///##### Use a local package
// replace github.com/ganeshrvel/go-mtpfs vxxxxxx-xxxxxxxxxx
// with ../go-mtpfs
